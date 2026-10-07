const NodeCache = require("node-cache");

const defaultTTL = Number(process.env.CACHE_TTL || 60);

// Shared singleton NodeCache instance
const cache = new NodeCache({
  stdTTL: defaultTTL,
  checkperiod: 120, // Automatic cleanup check every 120s
});

// Stats tracking for debug endpoints
const stats = {
  allTasks: {
    hits: 0,
    misses: 0,
  },
  singleTask: {
    hits: 0,
    misses: 0,
  },
};

function getCacheStats() {
  const totalHits = stats.allTasks.hits + stats.singleTask.hits;
  const totalMisses = stats.allTasks.misses + stats.singleTask.misses;

  return {
    hits: totalHits,
    misses: totalMisses,
    allTasks: {
      hits: stats.allTasks.hits,
      misses: stats.allTasks.misses,
    },
    singleTask: {
      hits: stats.singleTask.hits,
      misses: stats.singleTask.misses,
    },
    keys: cache.keys().length,
    ttlSeconds: defaultTTL,
  };
}

function clearCacheAndStats() {
  cache.flushAll();
  stats.allTasks.hits = 0;
  stats.allTasks.misses = 0;
  stats.singleTask.hits = 0;
  stats.singleTask.misses = 0;
}

module.exports = {
  cache,
  stats,
  defaultTTL,
  getCacheStats,
  clearCacheAndStats,
};
