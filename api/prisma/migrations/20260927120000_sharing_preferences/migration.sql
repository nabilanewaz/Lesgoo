-- Passenger sharing preferences (DESIGN.md §4, "Sharing preferences").
-- Additive with safe defaults, so existing rides keep today's behaviour (share with anyone).
ALTER TABLE "ride_requests" ADD COLUMN "share_ride" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ride_requests" ADD COLUMN "prefers_women" BOOLEAN NOT NULL DEFAULT false;

-- A preference about co-riders only makes sense if you're sharing.
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_preference_check" CHECK ("share_ride" OR NOT "prefers_women");
