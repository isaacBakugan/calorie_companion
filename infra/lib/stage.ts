/** 'prod' -> 'Prod', para nombres de stack en PascalCase. */
export function stackSuffix(stage: string): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}
