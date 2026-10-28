import { useCallback, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { CitizenDock } from '@/components/layouts/citizen-layout/citizen-dock';
import { CitizenLayout } from '@/components/layouts/citizen-layout/citizen-layout';
import { useToast } from '@/components/ui/toast/toast-context';
import { paths } from '@/config/paths';
import { FamilySosModal } from '@/features/family-sos/components/family-sos-modal';
import { IncidentLookupModal } from '@/features/incident-lookup';
import { InstallGuideModal, useInstallApp } from '@/features/install-app';
import { CitizenDocumentButton } from '@/features/incident-report';
import { useGeolocation } from '@/features/location/hooks/use-geolocation';
import { SurvivalGuideModal } from '@/features/survival-guide/components/survival-guide-modal';
import { saveActiveIncident } from '@/stores/active-incident';

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
  const openLookup = useCallback(() => setOpenModal('lookup'), []);
  const installApp = useInstallApp(toast.show);
  const navigate = useNavigate();

  return (
    <CitizenLayout
      dock={
        <CitizenDock
          onInstallApp={installApp.install}
          onOpenFamilySos={() => setOpenModal('family')}
          onOpenSurvivalGuide={() => setOpenModal('guide')}
          onOpenLookup={openLookup}
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
          <InstallGuideModal
            open={!!installApp.guide}
            platform={installApp.guide}
            onClose={installApp.closeGuide}
          />
          <IncidentLookupModal
            open={openModal === 'lookup'}
            onClose={closeModal}
            // open case found by code + phone: keep it on this device and go back to its call screen
            onResume={({ incident, citizenAccessToken }) => {
              saveActiveIncident(incident, citizenAccessToken);
              closeModal();
              navigate(paths.citizen.sos.getHref(incident.id));
            }}
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
      <Outlet context={{ geo, openLookup }} />
    </CitizenLayout>
  );
}
