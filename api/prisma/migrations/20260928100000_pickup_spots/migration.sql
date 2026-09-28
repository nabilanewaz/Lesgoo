-- Pickup and drop-off spots (DESIGN.md §3): well-known landmarks inside each area, so the driver
-- knows exactly where to stop. Names and coordinates were checked on OpenStreetMap.
-- x_m / y_m place each spot on the fare grid, in metres: an area's main spot sits exactly on the
-- area's grid point (fares between main spots are unchanged), the others are offset by their real
-- distance east/north of it. lat/lon are only used to open the spot in a maps app.
CREATE TABLE "spots" (
    "code" TEXT NOT NULL,
    "zone_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_bn" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "x_m" INTEGER NOT NULL,
    "y_m" INTEGER NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL,

    CONSTRAINT "spots_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "spots_zone_code_idx" ON "spots"("zone_code");
ALTER TABLE "spots" ADD CONSTRAINT "spots_zone_code_fkey" FOREIGN KEY ("zone_code") REFERENCES "zones"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Exactly one main spot per area: the one used when only the area is given.
CREATE UNIQUE INDEX "spots_one_main_per_zone" ON "spots"("zone_code") WHERE "is_main";

INSERT INTO "spots" ("code", "zone_code", "name", "name_bn", "lat", "lon", "x_m", "y_m", "is_main", "sort_order") VALUES
  ('BANANI_KAKOLI', 'BANANI', 'Kakoli bus stop', 'কাকলী', 23.79432, 90.40145, 0, 0, true, 1),
  ('BANANI_CHAIRMAN_BARI', 'BANANI', 'Chairman Bari', 'চেয়ারম্যান বাড়ি', 23.78815, 90.40100, -50, -680, false, 2),
  ('BANANI_SUPER_MARKET', 'BANANI', 'Banani Super Market', 'বনানী সুপার মার্কেট', 23.79318, 90.40615, 480, -130, false, 3),
  ('GULSHAN_2_CIRCLE', 'GULSHAN_2', 'Gulshan 2 Circle', 'গুলশান ২ গোলচত্বর', 23.79475, 90.41462, 1000, 0, true, 1),
  ('GULSHAN_2_PINK_CITY', 'GULSHAN_2', 'Pink City', 'পিংক সিটি', 23.79230, 90.41574, 1110, -270, false, 2),
  ('GULSHAN_1_CIRCLE', 'GULSHAN_1', 'Gulshan 1 Circle', 'গুলশান ১ গোলচত্বর', 23.78029, 90.41630, 1000, -2000, true, 1),
  ('GULSHAN_1_POLICE_PLAZA', 'GULSHAN_1', 'Police Plaza', 'পুলিশ প্লাজা', 23.77291, 90.41614, 980, -2820, false, 2),
  ('MOHAKHALI_AMTOLI', 'MOHAKHALI', 'Amtoli', 'আমতলী', 23.78086, 90.39921, 0, -2000, true, 1),
  ('MOHAKHALI_BUS_TERMINAL', 'MOHAKHALI', 'Mohakhali Bus Terminal', 'মহাখালী বাস টার্মিনাল', 23.77257, 90.40159, 240, -2920, false, 2),
  ('MOHAKHALI_RAIL_GATE', 'MOHAKHALI', 'Mohakhali Rail Gate', 'মহাখালী রেলগেট', 23.77862, 90.39813, -110, -2250, false, 3),
  ('BASHUNDHARA_JAMUNA_FUTURE_PARK', 'BASHUNDHARA', 'Jamuna Future Park', 'যমুনা ফিউচার পার্ক', 23.81350, 90.42409, 2000, 2000, true, 1),
  ('BASHUNDHARA_EVERCARE', 'BASHUNDHARA', 'Evercare (Apollo) Hospital', 'এভারকেয়ার (অ্যাপোলো) হাসপাতাল', 23.81025, 90.43120, 2720, 1640, false, 2),
  ('UTTARA_HOUSE_BUILDING', 'UTTARA', 'House Building', 'হাউস বিল্ডিং', 23.87483, 90.40069, -1000, 9000, true, 1),
  ('UTTARA_ABDULLAHPUR', 'UTTARA', 'Abdullahpur', 'আব্দুল্লাহপুর', 23.87964, 90.40119, -950, 9530, false, 2),
  ('UTTARA_AZAMPUR', 'UTTARA', 'Azampur', 'আজমপুর', 23.86848, 90.40054, -1020, 8300, false, 3),
  ('UTTARA_RAJLAKSHMI', 'UTTARA', 'Rajlakshmi', 'রাজলক্ষ্মী', 23.86448, 90.40021, -1050, 7860, false, 4),
  ('UTTARA_JASHIMUDDIN', 'UTTARA', 'Jashimuddin', 'জসিমউদ্দিন', 23.85926, 90.40156, -910, 7280, false, 5),
  ('UTTARA_AIRPORT', 'UTTARA', 'Airport (railway station)', 'এয়ারপোর্ট (রেলস্টেশন)', 23.85207, 90.40838, -220, 6480, false, 6),
  ('MIRPUR_10', 'MIRPUR', 'Mirpur 10 Circle', 'মিরপুর ১০ গোলচত্বর', 23.80757, 90.36859, -4000, 1000, true, 1),
  ('MIRPUR_2', 'MIRPUR', 'Mirpur 2 (Stadium)', 'মিরপুর ২ (স্টেডিয়াম)', 23.80539, 90.36313, -4560, 760, false, 2),
  ('MIRPUR_1', 'MIRPUR', 'Mirpur 1', 'মিরপুর ১', 23.79817, 90.35312, -5580, -40, false, 3),
  ('FARMGATE_METRO', 'FARMGATE', 'Farmgate Metro Station', 'ফার্মগেট মেট্রো স্টেশন', 23.75904, 90.38711, -1000, -4000, true, 1),
  ('FARMGATE_ANANDA_CINEMA', 'FARMGATE', 'Ananda Cinema Hall', 'আনন্দ সিনেমা হল', 23.75677, 90.39009, -700, -4250, false, 2),
  ('FARMGATE_KHAMARBARI', 'FARMGATE', 'Khamarbari', 'খামারবাড়ি', 23.75847, 90.38325, -1390, -4060, false, 3),
  ('DHANMONDI_27', 'DHANMONDI', 'Dhanmondi 27', 'ধানমন্ডি ২৭', 23.75603, 90.37572, -3000, -5000, true, 1),
  ('DHANMONDI_15', 'DHANMONDI', 'Dhanmondi 15', 'ধানমন্ডি ১৫', 23.74436, 90.37289, -3290, -6290, false, 2),
  ('DHANMONDI_SCIENCE_LAB', 'DHANMONDI', 'Science Lab', 'সায়েন্স ল্যাব', 23.73910, 90.38332, -2230, -6870, false, 3),
  ('DHANMONDI_SHANKAR', 'DHANMONDI', 'Shankar (Shankar Plaza)', 'শংকর', 23.75067, 90.36816, -3770, -5590, false, 4),
  ('MOTIJHEEL_SHAPLA_CHATTAR', 'MOTIJHEEL', 'Shapla Chattar', 'শাপলা চত্বর', 23.72657, 90.42163, 1000, -7000, true, 1),
  ('MOTIJHEEL_DAINIK_BANGLA', 'MOTIJHEEL', 'Dainik Bangla Mor', 'দৈনিক বাংলা মোড়', 23.73030, 90.41529, 350, -6590, false, 2);

-- The backfills below rewrite every ride row, and Postgres re-checks each rewritten row against
-- ride_requests_same_gender_check. That check is NOT VALID on purpose: a few rides booked before
-- the same-gender rules existed don't meet it. Set it aside for the backfill and restore it
-- exactly as before (still NOT VALID, still enforced on every new or changed ride).
ALTER TABLE "ride_requests" DROP CONSTRAINT "ride_requests_same_gender_check";

-- Every ride has a pickup and a drop-off spot; every trip has a meeting spot. Existing rows get
-- their area's main spot, which is exactly where their fare was measured from.
ALTER TABLE "ride_requests" ADD COLUMN "pickup_spot" TEXT;
ALTER TABLE "ride_requests" ADD COLUMN "dropoff_spot" TEXT;
UPDATE "ride_requests" r SET
  "pickup_spot"  = (SELECT s."code" FROM "spots" s WHERE s."zone_code" = r."pickup_zone"  AND s."is_main"),
  "dropoff_spot" = (SELECT s."code" FROM "spots" s WHERE s."zone_code" = r."dropoff_zone" AND s."is_main");
ALTER TABLE "ride_requests" ALTER COLUMN "pickup_spot" SET NOT NULL;
ALTER TABLE "ride_requests" ALTER COLUMN "dropoff_spot" SET NOT NULL;
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_pickup_spot_fkey" FOREIGN KEY ("pickup_spot") REFERENCES "spots"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_dropoff_spot_fkey" FOREIGN KEY ("dropoff_spot") REFERENCES "spots"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pools" ADD COLUMN "meeting_spot" TEXT;
UPDATE "pools" p SET "meeting_spot" = (SELECT s."code" FROM "spots" s WHERE s."zone_code" = p."pickup_zone" AND s."is_main");
ALTER TABLE "pools" ALTER COLUMN "meeting_spot" SET NOT NULL;
ALTER TABLE "pools" ADD CONSTRAINT "pools_meeting_spot_fkey" FOREIGN KEY ("meeting_spot") REFERENCES "spots"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Distances are now measured in metres (fares are charged per started 100 m). Same column,
-- same numbers x 1000, so nothing is lost; its CHECK (> 0) follows the rename.
ALTER TABLE "ride_requests" RENAME COLUMN "distance_km" TO "distance_m";
UPDATE "ride_requests" SET "distance_m" = "distance_m" * 1000;

ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_same_gender_check"
  CHECK (NOT "same_gender_only" OR ("share_ride" AND "passenger_gender" <> 'UNDISCLOSED')) NOT VALID;
