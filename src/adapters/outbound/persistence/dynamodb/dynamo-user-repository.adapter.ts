import type { UserProfile } from '../../../../domain/entities/user-profile';
import type { UserRepositoryPort } from '../../../../application/ports/user-repository.port';
import type { ElectroService } from './electrodb-schema';

export class DynamoUserRepository implements UserRepositoryPort {
  constructor(private readonly entity: ElectroService['entities']['userProfile']) {}

  async findById(userId: string): Promise<UserProfile | null> {
    const result = await this.entity.get({ userId }).go();
    return result.data;
  }

  async save(profile: UserProfile): Promise<void> {
    await this.entity.put(profile).go();
  }
}
