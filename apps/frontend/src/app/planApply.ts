/**
 * What applying a generated option changes: the pool courses it picks that the hand-built schedule
 * lacks are added, and pool courses a previously applied option added but this one drops are removed.
 */
export const planApply = (
  baseScheduled: readonly string[],
  appliedAdds: readonly string[],
  picks: readonly string[]
): { addCourses: string[]; removeCourses: string[] } => {
  const addCourses = picks.filter((id) => !baseScheduled.includes(id));
  return {
    addCourses,
    removeCourses: appliedAdds.filter((id) => !addCourses.includes(id)),
  };
};
