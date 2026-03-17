import { logger } from '@app/lib/logger';
import redis from '@app/lib/redis.ts';
import { getInboxCacheKey, getUserCacheKey } from '@app/lib/timeline/cache';

/*
对 Redis 中的 Timeline 缓存进行“截断清理（truncate）”，只保留最新的一部分数据，防止缓存无限增长

3类 timeline 缓存
| 类型    | Redis key   | 保留数量 |
| ------ | ----------- | ---- |
| 全局动态 | inbox:0     | 1000 |
| 用户动态 | user:{uid}  | 200  |
| inbox流 | inbox:{uid} | 200  |

缓存结构是 ZSET（有序集合）

为什么用 SCAN 而不是 KEYS ?
| 命令   | 问题      |
| ---- | ------- |
| KEYS | O(N) 阻塞 |
| SCAN | 游标迭代    |

Bangumi timeline 其实是 Fanout-on-write 流程：
用户发动态
    ↓
写数据库
    ↓
推送到关注者 timeline
    ↓
写 Redis ZSET
*/
export async function truncateGlobalCache() {
  logger.info('Truncating global timeline cache...');
  const cacheKey = getInboxCacheKey(0);
  logger.info(`Truncating global timeline cache with key: ${cacheKey}`);
  await redis.zremrangebyrank(cacheKey, 0, -1001);
}

export async function truncateUserCache() {
  logger.info('Truncating user timeline cache...');
  const keys = redis.scanStream({ match: getUserCacheKey('*'), type: 'zset' });
  for await (const key of keys) {
    logger.info(`Truncating user timeline cache with key: ${key}`);
    await redis.zremrangebyrank(key as string, 0, -201);
  }
}

export async function truncateInboxCache() {
  logger.info('Truncating inbox timeline cache...');
  const keys = redis.scanStream({ match: getInboxCacheKey('*'), type: 'zset' });
  for await (const key of keys) {
    logger.info(`Truncating inbox timeline cache with key: ${key}`);
    await redis.zremrangebyrank(key as string, 0, -201);
  }
}
