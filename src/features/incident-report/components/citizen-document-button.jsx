import { useState } from 'react';

import { CitizenDocumentModal } from './citizen-document-modal';

/**
 * "Xem & ký văn bản báo cáo" button. On the tracking screen once the incident is RESOLVED
 * (access = { incidentId, token }), or in "Tra Cứu" (access = { lookupCode, phoneLast4 }).
 *
 * @param {{ access: object, notify?: Function, className?: string, style?: object, closeOnSign?: boolean,
 *           autoOpen?: boolean }} props
 *   closeOnSign: close the document right after the citizen signs (tracking screen: then it counts down home)
 *   autoOpen: open the document by itself once (tracking screen when the incident is RESOLVED), remembered per
 *   incident so closing it or reloading does not pop it up again
 */
export function CitizenDocumentButton({
  access,
  notify,
  className,
  style,
  closeOnSign = false,
  autoOpen = false,
}) {
  // Kept as state so the modal's fetch is not re-run on every parent render
  const [opened, setOpened] = useState(() =>
    autoOpen && firstTime(access.incidentId) ? { ...access } : null,
  );
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

/** True the first time this incident's document is auto-opened on this device. */
function firstTime(incidentId) {
  if (!incidentId) return false;
  try {
    if (localStorage.getItem(SHOWN_KEY + incidentId)) return false;
    localStorage.setItem(SHOWN_KEY + incidentId, '1');
  } catch {
    // storage blocked: still open it, it may show again next time
  }
  return true;
}
