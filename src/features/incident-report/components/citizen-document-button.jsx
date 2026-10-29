import { useState } from 'react';

import { CitizenDocumentModal } from './citizen-document-modal';

/**
 * "Xem & ký văn bản báo cáo" button. On the tracking screen once the incident is RESOLVED
 * (access = { incidentId, token }), or in "Tra Cứu" (access = { lookupCode, phoneLast4 }).
 *
 * @param {{ access: object, notify?: Function, className?: string, style?: object, closeOnSign?: boolean,
 *           autoOpen?: boolean, signable?: boolean }} props
 *   closeOnSign: close the document right after the citizen signs (tracking screen: then it counts down home)
 *   autoOpen: open the document by itself (tracking screen once the incident is RESOLVED: the draft to read), and
 *   again once the officer saved it and it waits for the citizen's signature (signable). Each once per incident,
 *   remembered so closing it or reloading does not pop it up again
 */
export function CitizenDocumentButton({
  access,
  notify,
  className,
  style,
  closeOnSign = false,
  autoOpen = false,
  signable = false,
}) {
  const stage = signable ? 'sign' : 'view';
  // Kept as state so the modal's fetch is not re-run on every parent render
  const [opened, setOpened] = useState(() =>
    autoOpen && firstTime(access.incidentId, stage) ? { ...access } : null,
  );
  // the officer saved the report while this screen is open: open it again, now to sign (adjusted during render)
  const [seenStage, setSeenStage] = useState(stage);
  if (seenStage !== stage) {
    setSeenStage(stage);
    if (autoOpen && firstTime(access.incidentId, stage)) setOpened({ ...access });
  }
  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpened({ ...access })}>
        Xem &amp; ký văn bản báo cáo
      </button>
      <CitizenDocumentModal
        access={opened}
        notify={notify}
        onClose={() => setOpened(null)}
        onSigned={closeOnSign ? () => setOpened(null) : undefined}
      />
    </>
  );
}

const SHOWN_KEY = 'sos_document_shown_';

/** True the first time this incident's document is auto-opened at this stage (view / sign) on this device. */
function firstTime(incidentId, stage) {
  if (!incidentId) return false;
  const key = SHOWN_KEY + incidentId + (stage === 'sign' ? ':sign' : '');
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {
    // storage blocked: still open it, it may show again next time
  }
  return true;
}
