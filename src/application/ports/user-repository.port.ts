import type { UserProfile } from '../../domain/entities/user-profile';

export interface UserRepositoryPort {
  findById(userId: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}
