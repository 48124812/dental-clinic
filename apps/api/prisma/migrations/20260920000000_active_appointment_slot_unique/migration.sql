-- Prisma 6 cannot represent partial unique indexes in schema.prisma.
-- The database, rather than a read-before-write check, arbitrates concurrent bookings.
-- CANCELLED rows retain their history without reserving the slot.
-- Build the weaker index before dropping the old one; the transaction prevents
-- any window without uniqueness protection. This takes a write lock: deploy
-- during a maintenance window. A timeout rolls back both index changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE UNIQUE INDEX "Appointment_active_doctorId_startsAt_key"
ON "Appointment" ("doctorId", "startsAt")
WHERE "status" <> 'CANCELLED'::"AppointmentStatus";
DROP INDEX "Appointment_doctorId_startsAt_key";
COMMIT;
