import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router';

import { useToast } from '@/components/ui/toast/toast-context';
import { CallModal, IncidentTrackingView, ReportModal } from '@/features/incident-tracking';
import { SosRequestModal } from '@/features/sos-request/components/sos-request-modal';
import { SosHero } from '@/features/sos-trigger/components/sos-hero';
import { clearActiveIncident, loadActiveIncident } from '@/stores/active-incident';

/** "/" — Citizen Portal: Switches dynamically between SOS Trigger Hero and Live Realtime Incident Tracking. */
export function CitizenHomeRoute() {
  const { geo } = useOutletContext();
  const toast = useToast();
  const [requestOpen, setRequestOpen] = useState(false);
  const [activeSession, setActiveSession] = useState(() => loadActiveIncident());
  const [activeCall, setActiveCall] = useState(null); // { type: 'video' | 'voice', incomingSignal?: any }
  const [reportOpen, setReportOpen] = useState(false);

  const closeRequest = useCallback(() => setRequestOpen(false), []);

  useEffect(() => {
    document.body.classList.toggle('in-sos-tracking', Boolean(activeSession));
    return () => {
      document.body.classList.remove('in-sos-tracking');
    };
  }, [activeSession]);

  // Listen for incoming call requests via SSE while tracking
  useEffect(() => {
    if (!activeSession?.incident?.id) return undefined;
    const tokenQuery = activeSession.citizenAccessToken
      ? `?access_token=${encodeURIComponent(activeSession.citizenAccessToken)}`
      : '';
    let eventSource;
    try {
      eventSource = new EventSource(
        `/api/sos/stream/${encodeURIComponent(activeSession.incident.id)}${tokenQuery}`
      );
      const handleIncomingSignal = (e) => {
        try {
          const signal = JSON.parse(e.data);
          if (signal?.action === 'request' && signal?.sender !== 'citizen') {
            setActiveCall({
              type: signal.callType || 'video',
              incomingSignal: signal,
            });
          }
        } catch {}
      };
      eventSource.addEventListener('videocall_signal', handleIncomingSignal);
      eventSource.addEventListener('voicecall_signal', handleIncomingSignal);
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, [activeSession?.incident?.id, activeSession?.citizenAccessToken]);

  const handleSubmitted = ({ incident, mediaError }) => {
    setRequestOpen(false);
    const session = loadActiveIncident() || { incident, citizenAccessToken: '' };
    setActiveSession(session);
    toast.show(`✅ Đã kích hoạt theo dõi cứu hộ #${incident.id}. Trực ban đang điều phối ứng cứu!`, {
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

  const handleEndIncident = () => {
    clearActiveIncident();
    setActiveSession(null);
    setActiveCall(null);
    setReportOpen(false);
    toast.show('✅ Đã kết thúc ca cứu nạn. Bạn đã an toàn.', {
      tone: 'success',
      duration: 6000,
    });
  };

  return (
    <div>
      {activeSession ? (
        <>
          <IncidentTrackingView
            incident={activeSession.incident}
            citizenAccessToken={activeSession.citizenAccessToken}
            onEndIncident={handleEndIncident}
            onOpenVideoCall={() => setActiveCall({ type: 'video' })}
            onOpenVoiceCall={() => setActiveCall({ type: 'voice' })}
            onViewReport={() => setReportOpen(true)}
          />

          {activeCall && (
            <CallModal
              incident={activeSession.incident}
              citizenAccessToken={activeSession.citizenAccessToken}
              callType={activeCall.type}
              incomingSignal={activeCall.incomingSignal}
              onClose={() => setActiveCall(null)}
            />
          )}

          {reportOpen && (
            <ReportModal
              incident={activeSession.incident}
              citizenAccessToken={activeSession.citizenAccessToken}
              onClose={() => setReportOpen(false)}
            />
          )}
        </>
      ) : (
        <>
          <SosHero location={geo} onTrigger={() => setRequestOpen(true)} />
          <SosRequestModal
            open={requestOpen}
            onClose={closeRequest}
            location={geo}
            notify={toast.show}
            onSubmitted={handleSubmitted}
          />
        </>
      )}
    </div>
  );
}
