import bcrypt from 'bcryptjs';
import { Prisma, type User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError, conflict, unauthorized } from '../../lib/errors';
import type { LoginInput, SignupInput } from './auth.schemas';

const BCRYPT_ROUNDS = 10;

// Compared against when the email doesn't exist, so "unknown email" takes as long as
// "wrong password". Otherwise response time would reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

const toPublicUser = (u: User): PublicUser => ({ id: u.id, name: u.name, email: u.email, role: u.role });

export async function signup(input: SignupInput): Promise<PublicUser> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: 'PASSENGER' },
    });
    return toPublicUser(user);
  } catch (err) {
    // Rely on the unique index instead of "check then insert": two simultaneous sign-ups
    // with the same email can't both pass. P2002 = unique constraint violation.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordOk = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  // Same message for both cases, so the response doesn't reveal whether the email exists.
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return toPublicUser(user);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { vehicle: { select: { id: true, name: true, plate: true, capacity: true, isOnline: true } } },
  });
  // Token is valid but the account is gone: treat as signed out.
  if (!user) throw unauthorized();
  return { ...toPublicUser(user), vehicle: user.vehicle };
}
