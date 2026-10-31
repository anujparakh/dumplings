import { icons } from '../config/icons';

/** A friendly "nothing here" message for the drawer and the feed. */
export function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <img src={icons.logo} alt="" className="h-14 w-14 opacity-60" />
      <p className="text-lg font-semibold text-ink-muted">{message}</p>
    </div>
  );
}
