import { useCallback, useState } from 'react';
import { Outlet } from 'react-router';

import { CitizenDock } from '@/components/layouts/citizen-layout/citizen-dock';
import { CitizenLayout } from '@/components/layouts/citizen-layout/citizen-layout';
import { useToast } from '@/components/ui/toast/toast-context';
import { paths } from '@/config/paths';
import { FamilySosModal } from '@/features/family-sos/components/family-sos-modal';
import { IncidentLookupModal } from '@/features/incident-lookup';
import { CitizenDocumentButton } from '@/features/incident-report';
import { useGeolocation } from '@/features/location/hooks/use-geolocation';
import { SurvivalGuideModal } from '@/features/survival-guide/components/survival-guide-modal';

/**
 * Citizen portal shell. Owns the state several features share — the GPS
 * position and which dock modal is open — and passes it down, so features
 * never import each other.
 */
export function CitizenRoot() {
  const geo = useGeolocation();
  const toast = useToast();
  const [openModal, setOpenModal] = useState(null);
  const closeModal = useCallback(() => setOpenModal(null), []);

  return (
    <CitizenLayout
      dock={
        <CitizenDock
          onInstallApp={() => toast.show('Cài lối tắt (PWA) sẽ có ở module PWA.', { tone: 'info' })}
          onOpenFamilySos={() => setOpenModal('family')}
          onOpenSurvivalGuide={() => setOpenModal('guide')}
          onOpenLookup={() => setOpenModal('lookup')}
          dispatcherHref={paths.officer.login.getHref()}
        />
      }
      overlay={
        <>
          <FamilySosModal
            open={openModal === 'family'}
            onClose={closeModal}
            location={geo}
            notify={toast.show}
          />
          <SurvivalGuideModal open={openModal === 'guide'} onClose={closeModal} />
          <IncidentLookupModal
            open={openModal === 'lookup'}
            onClose={closeModal}
            documentSlot={(access) => (
              <CitizenDocumentButton
                access={access}
                notify={toast.show}
                className="btn-refresh-loc"
                style={{
                  justifyContent: 'center',
                  padding: 12,
                  fontSize: 15,
                  fontWeight: 800,
                  borderRadius: 12,
                }}
              />
            )}
          />
        </>
      }
    >
      <Outlet context={{ geo }} />
    </CitizenLayout>
  );
}
