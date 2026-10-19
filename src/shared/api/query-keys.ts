/**
 * Query key factory convention. Each feature calls createQueryKeys once with its own
 * scope and uses the returned builders, so keys are hierarchical and invalidation by
 * prefix (e.g. `keys.lists()`) works.
 *
 *   const facilityKeys = createQueryKeys('facilities');
 *   facilityKeys.list({ page: 1 }) // ['facilities', 'list', { page: 1 }]
 *   facilityKeys.detail('abc')     // ['facilities', 'detail', 'abc']
 */
export function createQueryKeys<const Scope extends string>(scope: Scope) {
  return {
    all: [scope] as const,
    lists: () => [scope, 'list'] as const,
    list: <Filters extends object>(filters?: Filters) => [scope, 'list', filters ?? {}] as const,
    details: () => [scope, 'detail'] as const,
    detail: (id: string) => [scope, 'detail', id] as const,
  };
}
