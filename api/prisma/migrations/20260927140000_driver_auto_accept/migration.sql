-- Drivers choose whether compatible riders may join their trip automatically (DESIGN.md §4).
-- Default ON keeps today's behaviour; a driver can turn it off (end of shift, wants to pick riders).
ALTER TABLE "vehicles" ADD COLUMN "auto_accept" BOOLEAN NOT NULL DEFAULT true;
