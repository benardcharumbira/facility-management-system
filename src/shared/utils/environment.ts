/**
 * Whether this is a production build. Placeholder content is shown, with a notice, everywhere
 * else; in a production build it is withheld. Read in one place so a test can change it.
 */
export const isProductionBuild = (): boolean => import.meta.env.PROD;
