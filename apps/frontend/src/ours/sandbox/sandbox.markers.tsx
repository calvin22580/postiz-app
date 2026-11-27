// OURS: the Sandbox label on upstream surfaces that show a post after it was
// approved (calendar rows and the post preview), so a test post is never
// presented as one that will go out. Each is called from upstream by one
// marked line and renders nothing for any other channel.
import { FC } from 'react';
import { SandboxNotice } from '@gitroom/frontend/ours/sandbox/sandbox.notice';

export const isSandboxChannel = (identifier?: string) => identifier === 'sandbox';

// Calendar rows: only where a row is wide enough to read (day and list
// views); the week and month cells already carry the Sandbox channel icon.
export const SandboxCalendarMarker: FC<{ identifier?: string; display: string }> = ({
  identifier,
  display,
}) =>
  isSandboxChannel(identifier) && display === 'day' ? (
    <div className="text-start" data-testid="sandbox-calendar-marker">
      <SandboxNotice compact text="Test only, never publishes" />
    </div>
  ) : null;

export const SandboxPreviewMarker: FC<{ identifier?: string }> = ({ identifier }) =>
  isSandboxChannel(identifier) ? (
    <div data-testid="sandbox-preview-marker">
      <SandboxNotice />
    </div>
  ) : null;
