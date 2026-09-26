-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PASSENGER', 'DRIVER');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('OPEN', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'MATCHED', 'DRIVER_ARRIVED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TESLAPAY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "capacity" SMALLINT NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "x_km" INTEGER NOT NULL,
    "y_km" INTEGER NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "pickup_zone" TEXT NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "capacity" SMALLINT NOT NULL,
    "seats_taken" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arrived_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL,
    "passenger_id" UUID NOT NULL,
    "pool_id" UUID,
    "pickup_zone" TEXT NOT NULL,
    "dropoff_zone" TEXT NOT NULL,
    "seats" SMALLINT NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "distance_km" INTEGER NOT NULL,
    "subtotal_paisa" INTEGER NOT NULL,
    "pool_discount_paisa" INTEGER,
    "fare_paisa" INTEGER,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "cancelled_at" TIMESTAMPTZ,
    "cancel_reason" TEXT,

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_events" (
    "id" BIGSERIAL NOT NULL,
    "ride_request_id" UUID,
    "pool_id" UUID,
    "actor_id" UUID,
    "type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_driver_id_key" ON "vehicles"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plate_key" ON "vehicles"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "zones_name_key" ON "zones"("name");

-- CreateIndex
CREATE INDEX "pools_status_pickup_zone_idx" ON "pools"("status", "pickup_zone");

-- CreateIndex
CREATE INDEX "pools_vehicle_id_created_at_idx" ON "pools"("vehicle_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_status_pickup_zone_idx" ON "ride_requests"("status", "pickup_zone");

-- CreateIndex
CREATE INDEX "ride_requests_passenger_id_created_at_idx" ON "ride_requests"("passenger_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ride_requests_pool_id_idx" ON "ride_requests"("pool_id");

-- CreateIndex
CREATE INDEX "ride_events_ride_request_id_idx" ON "ride_events"("ride_request_id");

-- CreateIndex
CREATE INDEX "ride_events_pool_id_idx" ON "ride_events"("pool_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_pickup_zone_fkey" FOREIGN KEY ("pickup_zone") REFERENCES "zones"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_passenger_id_fkey" FOREIGN KEY ("passenger_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_zone_fkey" FOREIGN KEY ("pickup_zone") REFERENCES "zones"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropoff_zone_fkey" FOREIGN KEY ("dropoff_zone") REFERENCES "zones"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_ride_request_id_fkey" FOREIGN KEY ("ride_request_id") REFERENCES "ride_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_events" ADD CONSTRAINT "ride_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;



-- ---------------------------------------------------------------------------
-- Hand-written below: rules Prisma's schema language cannot express.
-- These are the database's own guarantees, independent of application code.
-- ---------------------------------------------------------------------------

-- A Tesla has between 1 and 6 seats.
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_capacity_check" CHECK ("capacity" BETWEEN 1 AND 6);

-- Overbooking is impossible, even if a bug in the API tries it (DESIGN.md §8).
ALTER TABLE "pools" ADD CONSTRAINT "pools_capacity_check" CHECK ("capacity" BETWEEN 1 AND 6);
ALTER TABLE "pools" ADD CONSTRAINT "pools_seats_taken_check" CHECK ("seats_taken" >= 0 AND "seats_taken" <= "capacity");

-- A ride goes somewhere, for 1..3 seats, with non-negative money.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_zones_differ_check" CHECK ("pickup_zone" <> "dropoff_zone");
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_seats_check" CHECK ("seats" BETWEEN 1 AND 3);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_distance_check" CHECK ("distance_km" > 0);
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_money_check" CHECK (
  "subtotal_paisa" >= 0
  AND ("pool_discount_paisa" IS NULL OR "pool_discount_paisa" BETWEEN 0 AND "subtotal_paisa")
  AND ("fare_paisa" IS NULL OR "fare_paisa" >= 0)
);
-- Anything past MATCHED must belong to a pool.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pool_required_check" CHECK (
  "status" IN ('REQUESTED', 'CANCELLED') OR "pool_id" IS NOT NULL
);

-- One active pool per vehicle.
CREATE UNIQUE INDEX "pools_one_active_per_vehicle" ON "pools"("vehicle_id")
  WHERE "status" IN ('OPEN', 'DRIVER_ARRIVED', 'STARTED');

-- One active ride request per passenger.
CREATE UNIQUE INDEX "ride_requests_one_active_per_passenger" ON "ride_requests"("passenger_id")
  WHERE "status" NOT IN ('COMPLETED', 'CANCELLED');

-- Reference data: Dhaka zones on a km grid, Banani at the origin (DESIGN.md §3).
-- Lives in the migration, not the seed, because the app cannot work without it.
INSERT INTO "zones" ("code", "name", "x_km", "y_km") VALUES
  ('BANANI',      'Banani',       0,  0),
  ('GULSHAN_2',   'Gulshan 2',    1,  0),
  ('GULSHAN_1',   'Gulshan 1',    1, -2),
  ('MOHAKHALI',   'Mohakhali',    0, -2),
  ('BASHUNDHARA', 'Bashundhara',  2,  2),
  ('UTTARA',      'Uttara',      -1,  9),
  ('MIRPUR',      'Mirpur',      -4,  1),
  ('FARMGATE',    'Farmgate',    -1, -4),
  ('DHANMONDI',   'Dhanmondi',   -3, -5),
  ('MOTIJHEEL',   'Motijheel',    1, -7);
