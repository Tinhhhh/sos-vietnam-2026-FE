import { lazy, Suspense, useCallback, useState } from 'react';
import { useOutletContext } from 'react-router';

import { useToast } from '@/components/ui/toast/toast-context';
import { CitizenTopBar } from '@/components/layouts/citizen-layout/citizen-top-bar';
import { paths } from '@/config/paths';
import { SosRequestModal } from '@/features/sos-request/components/sos-request-modal';
import { SupplementMediaButton } from '@/features/sos-request/components/supplement-media-button';
import { CitizenDispatchButton } from '@/features/incident-dispatch';
import { CitizenDocumentButton } from '@/features/incident-report';
import { SosTrackingScreen } from '@/features/sos-tracking';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';
import { clearActiveIncident, loadActiveIncident } from '@/stores/active-incident';

// MapLibre only loads when the citizen opens the map picker
const LocationPicker = lazy(() =>
  import('@/features/location/components/location-picker').then((m) => ({ default: m.LocationPicker })),
);

/**
 * "/" — SOS trigger screen (legacy #sosTriggerView) + the SOS request form.
 * After sending, the waiting / call screen takes over until the citizen cancels or the case closes.
 * A reload or a new visit returns to it (the active incident is kept in localStorage); sending SOS
 * again from a phone that has an open SOS also returns to that one (BE answers resumed = true).
 */
export function CitizenHomeRoute() {
  const { geo } = useOutletContext();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [active, setActive] = useState(() => loadActiveIncident());
  const closeRequest = useCallback(() => setRequestOpen(false), []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = useCallback(() => setPickerOpen(true), []);

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
      <CitizenTopBar geo={geo} onPickOnMap={openPicker} officerHref={paths.officer.login.getHref()} />
      <SosHero onTrigger={() => setRequestOpen(true)} />
      <SosRequestModal
        open={requestOpen}
        onClose={closeRequest}
        location={geo}
        onPickLocation={openPicker}
        notify={toast.show}
        onSubmitted={handleSubmitted}
      />
      {pickerOpen && (
        <Suspense fallback={null}>
          <LocationPicker
            open
            initial={geo.coords}
            onClose={() => setPickerOpen(false)}
            onPick={(coords) => {
              geo.setManual(coords);
              setPickerOpen(false);
              toast.show('Đã đặt vị trí theo điểm bạn chọn trên bản đồ.', { tone: 'success' });
            }}
          />
        </Suspense>
      )}
      {active && (
        <SosTrackingScreen
          key={active.incident.id}
          initialIncident={active.incident}
          token={active.citizenAccessToken}
          notify={toast.show}
          onClosed={handleTrackingClosed}
          dispatchSlot={(p) => <CitizenDispatchButton {...p} />}
          mediaSlot={({ incident, token }) => (
            <SupplementMediaButton
              incidentId={incident.id}
              token={token}
              notify={toast.show}
              className="btn-refresh-loc"
              style={{ margin: '10px auto 0', padding: '8px 16px', fontWeight: 700, display: 'flex' }}
            />
          )}
          documentSlot={({ incident, token }) => (
            <CitizenDocumentButton
              access={{ incidentId: incident.id, token }}
              notify={toast.show}
              closeOnSign
              className="btn-refresh-loc"
              style={{ margin: '10px auto 0', padding: '8px 16px', fontWeight: 700, display: 'flex' }}
            />
          )}
        />
      )}
    </div>
  );
}
