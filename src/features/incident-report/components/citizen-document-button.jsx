import { useState } from 'react';

import { CitizenDocumentModal } from './citizen-document-modal';

/**
 * "Xem & ký văn bản báo cáo" button. On the tracking screen once the incident is RESOLVED
 * (access = { incidentId, token }), or in "Tra Cứu" (access = { lookupCode, phoneLast4 }).
 *
 * @param {{ access: object, notify?: Function, className?: string, style?: object, closeOnSign?: boolean }} props
 *   closeOnSign: close the document right after the citizen signs (tracking screen: then it counts down home)
 */
export function CitizenDocumentButton({ access, notify, className, style, closeOnSign = false }) {
  // Kept as state so the modal's fetch is not re-run on every parent render
  const [opened, setOpened] = useState(null);
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
