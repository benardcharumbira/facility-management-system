/** `plural(3, 'space')` is "3 spaces"; `plural(1, 'space')` is "1 space". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
