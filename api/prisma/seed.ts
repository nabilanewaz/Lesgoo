// Demo data: the cast from the Banani rush-hour story. Safe to run repeatedly (upserts).
// Run: npm run db:seed
import 'dotenv/config'; // DATABASE_URL from api/.env when run locally (Docker passes it directly)
import bcrypt from 'bcryptjs';
import { PrismaClient, type Gender, type UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// One shared demo password, documented in the README. Never used outside local/demo setups.
const DEMO_PASSWORD = 'rickshaw123';

type Person = { name: string; email: string; role: UserRole; gender: Gender; vehicle?: { name: string; plate: string; capacity: number } };

const cast: Person[] = [
  // Jashim and Bullet, his three-seat, battery-powered, entirely unaffiliated "Tesla".
  { name: 'Jashim', email: 'jashim@teslapool.dev', role: 'DRIVER', gender: 'MAN', vehicle: { name: 'Bullet', plate: 'DHAKA-TESLA-01', capacity: 3 } },
  // A second Tesla, so the demo can show two drivers competing for one request.
  { name: 'Karim', email: 'karim@teslapool.dev', role: 'DRIVER', gender: 'MAN', vehicle: { name: 'Toofan', plate: 'DHAKA-TESLA-02', capacity: 3 } },
  { name: 'Nusrat', email: 'nusrat@teslapool.dev', role: 'PASSENGER', gender: 'WOMAN' }, // Banani → Mohakhali, running late
  { name: 'Rafiq', email: 'rafiq@teslapool.dev', role: 'PASSENGER', gender: 'MAN' }, // Banani → Gulshan 1, two minutes later
  { name: 'Shirin', email: 'shirin@teslapool.dev', role: 'PASSENGER', gender: 'WOMAN' }, // wants the last seat
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const person of cast) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: person.role, gender: person.gender },
      create: { name: person.name, email: person.email, role: person.role, gender: person.gender, passwordHash },
    });

    if (person.vehicle) {
      await prisma.vehicle.upsert({
        where: { driverId: user.id },
        update: { name: person.vehicle.name, capacity: person.vehicle.capacity },
        create: { ...person.vehicle, driverId: user.id },
      });
    }
    console.log(`  ✓ ${person.name}${person.vehicle ? ` with ${person.vehicle.name}` : ''} <${person.email}>`);
  }
  console.log(`Seeded the Banani cast. Demo password for everyone: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
