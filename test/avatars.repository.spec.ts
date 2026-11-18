import type { Repository } from 'typeorm';
import type { AvatarEntity } from '../src/avatars/avatar.entity.js';
import { AvatarsRepository } from '../src/avatars/avatars.repository.js';

describe('AvatarsRepository.findDeletedBefore', () => {
  it('выбирает только мягко удалённые аватары старше срока хранения', async () => {
    const query = {
      withDeleted: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      orderBy: vi.fn(),
      take: vi.fn(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    query.withDeleted.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.andWhere.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    query.take.mockReturnValue(query);

    const orm = {
      createQueryBuilder: vi.fn().mockReturnValue(query),
    };
    const repository = new AvatarsRepository(
      orm as unknown as Repository<AvatarEntity>,
    );
    const cutoff = new Date('2026-11-01T00:00:00.000Z');

    await repository.findDeletedBefore(cutoff, 15, 100);

    expect(orm.createQueryBuilder).toHaveBeenCalledWith('avatar');
    expect(query.withDeleted).toHaveBeenCalled();
    expect(query.where).toHaveBeenCalledWith('avatar.deletedAt IS NOT NULL');
    expect(query.andWhere).toHaveBeenCalledWith('avatar.deletedAt < :cutoff', {
      cutoff,
    });
    expect(query.andWhere).toHaveBeenCalledWith('avatar.id > :afterId', {
      afterId: 15,
    });
    expect(query.orderBy).toHaveBeenCalledWith('avatar.id', 'ASC');
    expect(query.take).toHaveBeenCalledWith(100);
  });
});
