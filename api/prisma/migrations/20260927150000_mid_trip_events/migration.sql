-- Mid-trip events (DESIGN.md §6): each passenger is dropped off on their own, possibly early.
-- Forward-only: two nullable columns, existing rows are left as they are.
ALTER TABLE "ride_requests" ADD COLUMN "dropped_off_zone" TEXT;
ALTER TABLE "ride_requests" ADD COLUMN "completed_at" TIMESTAMPTZ;

ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropped_off_zone_fkey"
  FOREIGN KEY ("dropped_off_zone") REFERENCES "zones"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Only a finished ride has a drop-off point, and it is never where the ride began.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropped_off_check" CHECK (
  "dropped_off_zone" IS NULL OR ("status" = 'COMPLETED' AND "dropped_off_zone" <> "pickup_zone")
);
