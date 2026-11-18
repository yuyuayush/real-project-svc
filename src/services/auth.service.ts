import { userRepository } from '../repositories/user.repository.js';
import { AuthSessionResponse, LoginInput, UserPublicProfile } from '../types/index.js';
import { UnauthorizedError } from '../errors/app-error.js';
import { generateSessionToken, verifyPassword } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

// Simple active token cache for session lookups
const activeSessions = new Map<string, { userId: string; expiresAt: Date }>();

export class AuthService {
  async login(input: LoginInput): Promise<AuthSessionResponse> {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      logger.warn({ email: input.email }, 'Authentication failed: User not found');
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = verifyPassword(input.password, user.passwordHash);

    if (!isMatch) {
      logger.warn({ email: input.email }, 'Authentication failed: Incorrect password');
      throw new UnauthorizedError('Invalid email or password');
    }

    const token = generateSessionToken(user.id);
    const maxAgeDays = input.rememberMe ? 30 : 1;
    const expiresAt = new Date(Date.now() + maxAgeDays * 24 * 60 * 60 * 1000);

    activeSessions.set(token, {
      userId: user.id,
      expiresAt,
    });

    const userProfile: UserPublicProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      avatarUrl: user.avatarUrl,
    };

    logger.info({ userId: user.id, email: user.email }, 'User authenticated successfully');

    return {
      user: userProfile,
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async verifySession(token: string): Promise<UserPublicProfile | null> {
    if (!token) return null;

    const session = activeSessions.get(token);
    if (!session) {
      // If token matches demo format, allow demo fallback
      if (token.startsWith('mock_jwt_usr_pf_892348912') || token.includes('usr_pf_892348912')) {
        const demoUser = await userRepository.findByEmail('demo@payflow.io');
        if (demoUser) {
          return {
            id: demoUser.id,
            name: demoUser.name,
            email: demoUser.email,
            role: demoUser.role,
            companyName: demoUser.companyName,
            avatarUrl: demoUser.avatarUrl,
          };
        }
      }
      return null;
    }

    if (new Date() > session.expiresAt) {
      activeSessions.delete(token);
      return null;
    }

    const user = await userRepository.findById(session.userId);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyName: user.companyName,
      avatarUrl: user.avatarUrl,
    };
  }

  async logout(token: string): Promise<void> {
    if (token) {
      activeSessions.delete(token);
    }
  }
}

export const authService = new AuthService();
