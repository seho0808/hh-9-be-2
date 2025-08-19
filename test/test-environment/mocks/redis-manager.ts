export const MockRedisManager = {
  getClient: () => {
    const pipelineObj = {
      setex: () => pipelineObj,
      exec: async () => [],
    } as any;
    return {
      // used by ranking
      zincrby: async () => 1,
      zrevrange: async () => [],
      zunionstore: async () => 1,
      // used by cache service
      get: async () => null,
      setex: async () => "OK",
      del: async (..._keys: string[]) => 1,
      keys: async (_pattern: string) => [],
      exists: async () => 0,
      rename: async () => "OK",
      expire: async () => 1,
      // used by cache service setMultiple
      pipeline: () => pipelineObj,
    } as any;
  },
};
