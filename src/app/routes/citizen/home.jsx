import { useCallback, useState } from 'react';
import { useOutletContext } from 'react-router';

import { useToast } from '@/components/ui/toast/toast-context';
import { LocationBanner } from '@/features/location/components/location-banner';
import { SosRequestModal } from '@/features/sos-request/components/sos-request-modal';
import { SosTrackingScreen } from '@/features/sos-tracking';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';
import { clearActiveIncident, loadActiveIncident } from '@/stores/active-incident';

/**
 * "/" — SOS trigger screen (legacy #sosTriggerView) + the SOS request form.
 * After sending, the waiting / call screen takes over until the citizen cancels or the case closes.
 * A reload returns to it (the active incident is kept in sessionStorage).
 */
export function CitizenHomeRoute() {
  const { geo } = useOutletContext();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [active, setActive] = useState(() => loadActiveIncident());
  const closeRequest = useCallback(() => setRequestOpen(false), []);

  const handleSubmitted = ({ incident, mediaError }) => {
    setRequestOpen(false);
    // The form saved the incident + token just before calling us
    setActive(loadActiveIncident() || { incident, citizenAccessToken: '' });
    if (mediaError) {
      toast.show(`Tin báo đã gửi, nhưng ảnh/video chưa tải lên được: ${mediaError}`, {
        tone: 'warning',
        duration: 9000,
      });
    }
  };

  const handleTrackingClosed = (message) => {
    clearActiveIncident();
    setActive(null);
    if (message) toast.show(message, { tone: 'info', duration: 8000 });
  };

  return (
    <div>
      <LocationBanner geo={geo} />
      <SosHero onTrigger={() => setRequestOpen(true)} />
      <SosRequestModal
        open={requestOpen}
        onClose={closeRequest}
        location={geo}
        notify={toast.show}
        onSubmitted={handleSubmitted}
      />
      {active && (
        <SosTrackingScreen
          key={active.incident.id}
          initialIncident={active.incident}
          token={active.citizenAccessToken}
          notify={toast.show}
          onClosed={handleTrackingClosed}
        />
      )}
    </div>
  );
}
