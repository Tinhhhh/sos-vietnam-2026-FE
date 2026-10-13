import { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router';

import { useToast } from '@/components/ui/toast/toast-context';
import { SosRequestModal } from '@/features/sos-request/components/sos-request-modal';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';

/** "/" — SOS trigger screen (legacy #sosTriggerView) + the SOS request form. */
export function CitizenHomeRoute() {
  const { geo } = useOutletContext();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const closeRequest = useCallback(() => setRequestOpen(false), []);

  const handleSubmitted = ({ incident, mediaError }) => {
    setRequestOpen(false);
    toast.show(`✅ Đã phát tín hiệu SOS ${incident.id}. Trực ban đang tiếp nhận.`, {
      tone: 'success',
      duration: 8000,
    });
    if (mediaError) {
      toast.show(`Tin báo đã gửi, nhưng ảnh/video chưa tải lên được: ${mediaError}`, {
        tone: 'warning',
        duration: 9000,
      });
    }
  };

  return (
    <div>
      <SosHero onTrigger={() => setRequestOpen(true)} />
      <SosRequestModal
        open={requestOpen}
        onClose={closeRequest}
        location={geo}
        notify={toast.show}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
