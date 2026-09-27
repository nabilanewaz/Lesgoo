-- Replace the one-sided "prefers women co-riders" flag with symmetric same-gender rides.
-- Why: showing "prefer women" to everyone let men request women co-riders, and gave men no
-- equivalent. Now riders declare a gender and may ask to share only with their own gender.
-- Non-destructive: nothing is dropped; the old flag is renamed and its meaning tightened.

CREATE TYPE "Gender" AS ENUM ('WOMAN', 'MAN', 'UNDISCLOSED');

-- Self-declared, optional ("prefer not to say" = UNDISCLOSED).
ALTER TABLE "users" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED';

ALTER TABLE "ride_requests" DROP CONSTRAINT "ride_requests_preference_check";
ALTER TABLE "ride_requests" RENAME COLUMN "prefers_women" TO "same_gender_only";
ALTER TABLE "ride_requests" ADD COLUMN "passenger_gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED';

-- Same-gender only makes sense when sharing and when the rider declared a gender.
-- NOT VALID: enforced for every new or updated row, without rewriting old test rides that used
-- the previous flag (all of them are finished; matching only looks at active rides).
ALTER TABLE "ride_requests" ADD CONSTRAINT "ride_requests_same_gender_check"
  CHECK (NOT "same_gender_only" OR ("share_ride" AND "passenger_gender" <> 'UNDISCLOSED')) NOT VALID;
