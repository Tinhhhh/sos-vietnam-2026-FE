import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';
import { CitizenTopBar } from '@/components/layouts/citizen-layout/citizen-top-bar';
import { paths } from '@/config/paths';
import { SosRequestModal } from '@/features/sos-request/components/sos-request-modal';
import { SupplementMediaButton } from '@/features/sos-request/components/supplement-media-button';
import { CitizenDispatchButton } from '@/features/incident-dispatch';
import { CitizenDocumentButton } from '@/features/incident-report';
import { SosTrackingScreen } from '@/features/sos-tracking';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';
import { clearActiveIncident, loadOpenIncidents } from '@/stores/active-incident';

// MapLibre only loads when the citizen opens the map picker
const LocationPicker = lazy(() =>
  import('@/features/location/components/location-picker').then((m) => ({ default: m.LocationPicker })),
);

const TIME = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * "/" and "/sos/:incidentId" — SOS trigger screen (legacy #sosTriggerView) + the SOS request form; on
 * /sos/{id} the waiting / call screen of that case takes over until it closes.
 * The device keeps its open cases (up to 2 per phone, docs/spec-multi-case.md): opening "/" with one open case
 * goes straight to it, with two the citizen picks one. Each tab shows one case, so two tabs can follow two cases.
 */
export function CitizenHomeRoute() {
  const { geo, openLookup } = useOutletContext();
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const closeRequest = useCallback(() => setRequestOpen(false), []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = useCallback(() => setPickerOpen(true), []);

  // open cases of this device, re-read on every URL change and when another tab adds / closes a case
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const onStorage = (e) => (!e.key || e.key.startsWith('sos_')) && refresh();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- incidentId / version only trigger a fresh read
  const cases = useMemo(() => loadOpenIncidents(), [incidentId, version]);

  const active = incidentId ? cases.find((c) => c.incident.id === incidentId) || null : null;
  const others = cases.filter((c) => c.incident.id !== incidentId);

  // /sos/{id} of a case this device does not hold (closed, other device): back to the menu
  const warned = useRef(null);
  useEffect(() => {
    if (!incidentId || active || warned.current === incidentId) return;
    warned.current = incidentId;
    toast.show('Tin báo này không còn trên máy. Dùng "Tra Cứu" với mã ca để vào lại.', {
      tone: 'info',
      duration: 8000,
    });
    navigate(paths.citizen.home.getHref(), { replace: true });
  }, [incidentId, active, navigate, toast]);

  // "/" with exactly one open case: straight to its call screen (as before)
  useEffect(() => {
    if (!incidentId && cases.length === 1) {
      navigate(paths.citizen.sos.getHref(cases[0].incident.id), { replace: true });
    }
  }, [incidentId, cases, navigate]);
  const [chooserDismissed, setChooserDismissed] = useState(false);
  const chooser = !incidentId && cases.length >= 2 && !chooserDismissed;

  const handleSubmitted = ({ incident, mediaError }) => {
    setRequestOpen(false);
    refresh(); // the form saved the incident + token just before calling us
    navigate(paths.citizen.sos.getHref(incident.id));
    if (mediaError) {
      toast.show(`Tin báo đã gửi, nhưng ảnh/video chưa tải lên được: ${mediaError}`, {
        tone: 'warning',
        duration: 9000,
      });
    }
  };

  const handleTrackingClosed = (message) => {
    clearActiveIncident(active?.incident.id);
    refresh();
    navigate(paths.citizen.home.getHref(), { replace: true });
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
        onOpenLookup={() => {
          setRequestOpen(false);
          openLookup();
        }}
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
      {chooser && (
        <CaseChooser
          cases={cases}
          onPick={(id) => navigate(paths.citizen.sos.getHref(id))}
          onClose={() => setChooserDismissed(true)}
        />
      )}
      {active && (
        <SosTrackingScreen
          key={active.incident.id}
          initialIncident={active.incident}
          token={active.citizenAccessToken}
          notify={toast.show}
          onClosed={handleTrackingClosed}
          notice={
            others.length > 0 ? (
              <button
                type="button"
                className="btn-refresh-loc"
                style={{
                  margin: '8px auto 0',
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                }}
                onClick={() => navigate(paths.citizen.sos.getHref(others[0].incident.id))}
              >
                Bạn có {others.length} tin báo khác đang mở: xem
              </button>
            ) : null
          }
          dispatchSlot={(p) => <CitizenDispatchButton {...p} />}
          mediaSlot={({ incident, token }) => (
            <SupplementMediaButton incidentId={incident.id} token={token} notify={toast.show} />
          )}
          documentSlot={({ incident, token }) => (
            <CitizenDocumentButton
              access={{ incidentId: incident.id, token }}
              notify={toast.show}
              closeOnSign
              autoOpen
              className="btn-refresh-loc"
              style={{ margin: '10px auto 0', padding: '8px 16px', fontWeight: 700, display: 'flex' }}
            />
          )}
        />
      )}
    </div>
  );
}

/** Two open SOS on this device: pick the one to follow (each can also stay open in its own tab). */
function CaseChooser({ cases, onPick, onClose }) {
  return (
    <Modal open onClose={onClose} solid containerStyle={{ maxWidth: 440 }} title="Bạn có tin báo đang mở">
      <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: 14 }}>
        Máy này đang có {cases.length} tin báo chưa kết thúc. Chọn tin báo để quay lại màn hình theo dõi /
        gọi.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cases.map(({ incident }) => {
          const at = incident.created_at ? TIME.format(new Date(incident.created_at)) : null;
          const what = incident.incident_tags?.[0] || incident.emergency_type_label || 'Tin báo SOS';
          return (
            <button
              key={incident.id}
              type="button"
              className="btn-refresh-loc"
              style={{ justifyContent: 'space-between', padding: '12px 14px', fontWeight: 700 }}
              onClick={() => onPick(incident.id)}
            >
              <span>{what}</span>
              <span style={{ fontWeight: 500, opacity: 0.8 }}>
                {[at, incident.id].filter(Boolean).join(' · ')}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="btn-refresh-loc"
          style={{ justifyContent: 'center', padding: 10, opacity: 0.8 }}
          onClick={onClose}
        >
          Trở lại menu
        </button>
      </div>
    </Modal>
  );
}
