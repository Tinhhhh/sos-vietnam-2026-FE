import { useEffect, useMemo, useState } from 'react';

import { Modal } from '@/components/ui/modal/modal';
import { useToast } from '@/components/ui/toast/toast-context';

import {
  arriveDispatch,
  changeFieldMember,
  departDelegation,
  getDispatchPlan,
  getRoadSnap,
  saveDispatchPlan,
} from '../api/dispatch-api';
import { reverseGeocode, searchAddress } from '../api/geocode';
import {
  formatDistance,
  formatDuration,
  haversineKm,
  routeDetail,
  routeTable,
  straightEstimate,
} from '../api/routing';
import { STATION_ICON, needsDelegation, originCandidates } from '../utils/origin-candidates';
import { ArriveControl, DepartButton } from './arrive-control';
import styles from './dispatch.module.css';
import { DelegationStep } from './delegation-step';
import delegationStyles from './delegation.module.css';
import { DispatchStepper } from './dispatch-stepper';
import { DispatchTrackingView } from './dispatch-tracking-view';
import trackingStyles from './dispatch-tracking.module.css';
import { FieldLinkBox } from './field-link-box';
import { FieldOfficerChange, FieldOfficerPicker } from './field-officer-picker';
import { FinishPanel } from './finish-panel';
import { RouteMap } from './route-map';

const ROAD_LIMIT = 40; // nearest stations that get a real road estimate; the rest straight-line
const DELAY_NOTE = 'Thời gian thực tế có thể lâu hơn do ùn tắc giao thông hoặc thời tiết không thuận lợi.';

const LEVEL_LABEL = { province: 'Trụ sở tỉnh', ward: 'Cơ sở xã/phường' };

// Step keys stored in the draft (1..4). Ward police send their own station: no "Uỷ quyền" step.
const STEP_KEYS = ['dispatch', 'delegate', 'track', 'finish'];
// step 2 is "Điều động" (pick the field officer) when my own unit goes, "Uỷ quyền" when a ward unit does
const STEP_TITLES = { dispatch: 'Chọn tuyến', delegate: 'Uỷ quyền', track: 'Theo dõi', finish: 'Kết thúc' };
const SENT_AT = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const BRIEF_KEY = 'sos_dispatch_brief';
const ptKey = (p) => (p ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : '');

/**
 * Dispatch window of one incident (opens after "Xác nhận điều động", reopens from "Chi tiết
 * điều động"). Batch 1: step 1 Điều động — correct the destination, pick the starting station with
 * road distance / time for each, preview the route. Later steps show what was chosen.
 *
 * The saved plan (station, destination, route, step) comes from the BE
 * (GET /incidents/{id}/dispatch-plan); "Chọn" / "Xác nhận điều động" saves it (PUT).
 * Give it `key={incident.id}` so the plan is re-read for another incident.
 *
 * @param {{ incident: object, typeLabel?: string, officer: object, stations: object[], onClose: () => void,
 *           LocationPicker: React.ComponentType }} props  map picker of the location feature (composed by the route)
 */
export function DispatchWindow(props) {
  const { incident, onClose } = props;
  const [loaded, setLoaded] = useState({ status: 'loading', plan: null, error: null });

  useEffect(() => {
    let alive = true;
    getDispatchPlan(incident.id)
      .then((plan) => alive && setLoaded({ status: 'ready', plan, error: null }))
      .catch((err) => alive && setLoaded({ status: 'error', plan: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, [incident.id]);

  if (loaded.status !== 'ready') {
    return (
      <Modal
        open
        onClose={onClose}
        solid
        containerStyle={{ maxWidth: 520 }}
        title={<span className={styles.windowTitle}>Điều động lực lượng · Ca {incident.id}</span>}
      >
        <div className={loaded.status === 'error' ? styles.warn : styles.muted}>
          {loaded.status === 'error' ? `Không tải được kế hoạch điều động: ${loaded.error}` : 'Đang tải...'}
        </div>
      </Modal>
    );
  }
  return <DispatchWindowBody {...props} initialPlan={loaded.plan} />;
}

function DispatchWindowBody({
  incident,
  typeLabel,
  officer,
  stations,
  stationsStatus = 'ready',
  onClose,
  onFinished,
  LocationPicker,
  initialPlan,
  onCallTracker,
  onCallDelegate,
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(initialPlan);
  const [editing, setEditing] = useState(!draft || draft.step === 1);
  const [changingField, setChangingField] = useState(false);
  const [saving, setSaving] = useState(false);

  // The ward unit accepts / rejects / sets off on its own screen: every queue push of this incident
  // re-reads the plan so this window follows (unless the officer is editing step 1).
  useEffect(() => {
    if (editing) return undefined;
    let alive = true;
    getDispatchPlan(incident.id)
      .then((plan) => alive && setDraft(plan))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [incident, editing]);
  const [destination, setDestination] = useState(
    () =>
      draft?.destination ||
      (incident.lat != null
        ? {
            lat: incident.lat,
            lng: incident.lng,
            address: [incident.address, incident.ward, incident.province].filter(Boolean).join(', '),
            source: 'CITIZEN_GPS',
          }
        : null),
  );
  const [selectedId, setSelectedId] = useState(draft?.origin?.stationId ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // own unit goes: who goes out with the GPS phone (a delegated unit picks it on its card)

  const { mode, stations: candidates } = useMemo(
    () => originCandidates(officer, incident, stations),
    [officer, incident, stations],
  );

  // Road estimate for every candidate (nearest first). Belongs to one destination.
  const [estimates, setEstimates] = useState({ key: '', byId: {}, error: null });
  const destKey = ptKey(destination);
  useEffect(() => {
    if (!destination || candidates.length === 0) return undefined;
    const ctrl = new AbortController();
    const byDistance = [...candidates].sort(
      (a, b) => haversineKm(a, destination) - haversineKm(b, destination),
    );
    const near = byDistance.slice(0, ROAD_LIMIT);
    const byId = {};
    byDistance.slice(ROAD_LIMIT).forEach((s) => (byId[s.id] = straightEstimate(s, destination)));
    routeTable(near, destination, { signal: ctrl.signal })
      .then((rows) => {
        near.forEach((s, i) => (byId[s.id] = rows[i] || straightEstimate(s, destination)));
        setEstimates({ key: destKey, byId, error: null });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        near.forEach((s) => (byId[s.id] = straightEstimate(s, destination)));
        setEstimates({ key: destKey, byId, error: err.message });
      });
    return () => ctrl.abort();
  }, [candidates, destination, destKey]);
  const est = estimates.key === destKey ? estimates.byId : null;

  const sorted = useMemo(() => {
    const dur = (s) => est?.[s.id]?.durationS ?? Infinity;
    const list = [...candidates].sort(
      (a, b) => dur(a) - dur(b) || haversineKm(a, destination) - haversineKm(b, destination),
    );
    // Province HQ ("cơ sở hiện tại") first, then the ward stations by travel time
    return mode === 'province'
      ? [...list.filter((s) => s.level !== 'ward'), ...list.filter((s) => s.level === 'ward')]
      : list;
  }, [candidates, est, destination, mode]);

  // Ward police: their own station, nearest one preselected
  const effectiveId = selectedId ?? (mode === 'ward' ? sorted[0]?.id : null);
  const selected = candidates.find((s) => s.id === effectiveId) || null;

  const [route, setRoute] = useState({ key: '', data: null, error: null });
  const routeKey = selected && destination ? `${selected.id}|${destKey}` : '';
  useEffect(() => {
    if (!routeKey) return undefined;
    const ctrl = new AbortController();
    routeDetail(selected, destination, { signal: ctrl.signal })
      .then((data) => setRoute({ key: routeKey, data, error: null }))
      .catch((err) => !ctrl.signal.aborted && setRoute({ key: routeKey, data: null, error: err.message }));
    return () => ctrl.abort();
  }, [routeKey, selected, destination]);
  const currentRoute = route.key === routeKey ? route.data : null;
  const routeError = route.key === routeKey ? route.error : null;

  const confirmOrigin = async () => {
    if (!selected || !destination) return;
    const delegate = needsDelegation(officer, selected);
    setSaving(true);
    try {
      const next = await saveDispatchPlan(incident.id, {
        stationId: selected.id,
        destination,
        route: currentRoute || {
          ...(est?.[selected.id] || straightEstimate(selected, destination)),
          coords: null,
        },
        delegate,
      });
      setDraft(next);
      setEditing(false);
      toast.show(
        delegate
          ? `Đã chọn ${selected.name}: chuyển sang bước uỷ quyền`
          : next?.status === 'EN_ROUTE'
            ? `Đã cập nhật tuyến của ${selected.name}`
            : `Đã chọn ${selected.name}: chỉ định người phụ trách hiện trường để điều động`,
        { tone: 'success' },
      );
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const rejected = draft?.status === 'REJECTED';
  const step = editing || rejected ? 1 : draft?.step || 1;

  // Back to step 1 reopens the form; the saved plan stays until it is confirmed again.
  const goBack = () => setEditing(true);

  // Handed to a ward officer who has not answered yet: the plan is locked (BE refuses changes too)
  const waitingAnswer = draft?.status === 'PENDING_ACCEPT' && !!draft?.assignedTo;
  // The ward took the delegated case: the next steps are theirs, the holder cannot go back and re-plan (BE 409)
  const delegateTook = draft?.status === 'ACCEPTED' && !!draft?.assignedTo;
  // "Khởi hành" pressed: the earlier steps are closed for good
  const departed = ['EN_ROUTE', 'ARRIVED', 'DONE'].includes(draft?.status);
  // own unit on the way: "Đổi người" (the field officer) next to the tracking card
  const canArrive = step === 3 && draft?.status === 'EN_ROUTE' && !draft?.assignedTo;
  // the holder issues the field link when their unit goes or for a PCCC / CSGT team they appointed
  const holderLink =
    !!draft?.tracker && (!draft.assignedTo || draft.assignedTo.memberId === draft.tracker.memberId);
  const isWard = mode === 'ward';
  // my own unit goes (ward police, province HQ): step 2 picks the field officer, no delegation
  const ownUnit = !!draft && !needsDelegation(officer, draft.origin);
  const steps = STEP_KEYS.map((key) => ({
    key,
    title: key === 'delegate' && (ownUnit || (isWard && !draft)) ? 'Điều động' : STEP_TITLES[key],
  }));

  return (
    <Modal
      open
      onClose={pickerOpen ? () => {} : onClose}
      solid
      containerStyle={{ maxWidth: 1120, width: 'min(1120px, calc(100vw - 24px))' }}
      title={<span className={styles.windowTitle}>Điều động lực lượng · Ca {incident.id}</span>}
    >
      <DispatchStepper steps={steps} current={STEP_KEYS[step - 1]} />

      {step === 1 && rejected && (
        <div className={delegationStyles.rejectedBanner}>
          {draft.assignedTo ? (
            <>
              <b>{draft.assignedTo.fullName}</b> ({draft.origin.name}) đã từ chối
              {draft.rejectReason ? `: "${draft.rejectReason}"` : ''}. Chọn đơn vị khác để điều động.
            </>
          ) : (
            // nobody refused: the BE stopped the previous trip (the ward escalated the case after picking a route)
            <>
              Lượt điều động trước (<b>{draft.origin.name}</b>) đã dừng
              {draft.rejectReason ? `: ${draft.rejectReason}` : ''}. Chọn tuyến để điều động lại.
            </>
          )}
        </div>
      )}
      {step === 1 ? (
        <div className={styles.layout}>
          <div className={styles.side}>
            <DestinationBox
              destination={destination}
              original={incident}
              typeLabel={typeLabel}
              onChange={setDestination}
              onOpenPicker={() => setPickerOpen(true)}
            />
            {stationsStatus !== 'ready' && candidates.length === 0 && (
              <div className={styles.box}>
                <div className={styles.muted}>
                  {stationsStatus === 'error'
                    ? 'Chưa tải được danh sách trụ sở, đang thử lại...'
                    : 'Đang tải danh sách trụ sở...'}
                </div>
              </div>
            )}
            {!isWard && (
              <OriginList
                stations={sorted}
                estimates={est}
                estimateError={estimates.key === destKey ? estimates.error : null}
                selectedId={effectiveId}
                onSelect={setSelectedId}
                hasDestination={!!destination}
              />
            )}
          </div>
          <div className={styles.mapCol}>
            <RouteMap
              origin={selected}
              destination={destination}
              coords={currentRoute?.coords || null}
              citizen={incident.lat != null ? { lat: incident.lat, lng: incident.lng } : null}
            />
            <RouteSummary
              station={selected}
              route={currentRoute || (selected && est?.[selected.id]) || null}
              error={routeError}
            />
          </div>
          <div className={styles.footer}>
            {draft?.step > 1 && !rejected && (
              <button type="button" className={styles.btnBack} onClick={() => setEditing(false)}>
                ← Giữ lựa chọn cũ
              </button>
            )}
            {selected && needsDelegation(officer, selected) && (
              <span className={styles.footerHint}>
                Cơ sở xã/phường: bước tiếp theo sẽ liên hệ và uỷ quyền ca cho đơn vị này.
              </span>
            )}
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!selected || !destination || saving}
              onClick={confirmOrigin}
            >
              {saving
                ? 'Đang lưu...'
                : isWard
                  ? 'Tiếp tục'
                  : selected
                    ? `Chọn ${selected.name}`
                    : 'Chọn điểm xuất phát'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {step >= 3 ? (
            <>
              <DispatchTrackingView
                plan={draft}
                incidentId={incident.id}
                onCallTracker={onCallTracker ? (tracker) => onCallTracker(incident, tracker) : null}
                onCallDelegate={onCallDelegate ? (d) => onCallDelegate(incident, d) : null}
                // "Đã đến" when the GPS is within the radius; without GPS only when my own unit goes (delegated: the ward / field officer do)
                renderArrive={(check) => (
                  <ArriveControl
                    check={check}
                    canOverride={!draft.assignedTo}
                    onArrive={(reason) => arriveDispatch(incident.id, { reason })}
                    onPlan={setDraft}
                  />
                )}
                // the simulated vehicle drives this route with this officer: both changes wait until it stops
                actions={
                  (canArrive || (step === 3 && !draft.assignedTo)) &&
                  (({ simulating }) => (
                    <>
                      {canArrive && (
                        <button
                          type="button"
                          className={trackingStyles.actionBtn}
                          disabled={simulating}
                          title={simulating ? 'Đang mô phỏng: dừng mô phỏng rồi mới đổi người' : undefined}
                          onClick={() => setChangingField(true)}
                        >
                          {simulating ? '🔒 Đổi người' : 'Đổi người'}
                        </button>
                      )}
                      {/* a delegated trip is the ward's: the province changes neither origin nor destination */}
                      {step === 3 && !draft.assignedTo && (
                        <button
                          type="button"
                          className={trackingStyles.actionBtn}
                          disabled={simulating}
                          title={simulating ? 'Đang mô phỏng: dừng mô phỏng rồi mới đổi điểm' : undefined}
                          onClick={() => setEditing(true)}
                        >
                          {simulating ? '🔒 ' : ''}
                          {isWard ? 'Đổi điểm đến' : 'Đổi điểm xuất phát / điểm đến'}
                        </button>
                      )}
                    </>
                  ))
                }
              />
              {holderLink && ['EN_ROUTE', 'ARRIVED'].includes(draft.status) && (
                <FieldLinkBox incidentId={incident.id} plan={draft} />
              )}
              {canArrive && changingField && (
                <FieldOfficerChange
                  incidentId={incident.id}
                  plan={draft}
                  onPlan={setDraft}
                  open
                  onClose={() => setChangingField(false)}
                />
              )}
            </>
          ) : (
            <div className={delegationStyles.panel}>
              <ChosenSummary
                draft={draft}
                canPickOrigin={!isWard}
                locked={waitingAnswer || delegateTook}
                onEdit={() => setEditing(true)}
              />
              {ownUnit ? (
                <OwnDispatchStep incidentId={incident.id} plan={draft} onPlan={setDraft} />
              ) : (
                <DelegationStep
                  incidentId={incident.id}
                  plan={draft}
                  onPlan={setDraft}
                  locked={waitingAnswer}
                />
              )}
              {/* PCCC / CSGT team appointed (it is also the field officer): the holder sends the link and sets off */}
              {!ownUnit && holderLink && draft.status === 'ACCEPTED' && (
                <>
                  <FieldLinkBox incidentId={incident.id} plan={draft} />
                  <DepartButton
                    who={draft.tracker.fullName}
                    onDepart={() => departDelegation(incident.id)}
                    onPlan={setDraft}
                  />
                </>
              )}
            </div>
          )}
          {step === 4 ? (
            <FinishPanel
              incidentId={incident.id}
              plan={draft}
              canConfirm={!draft.assignedTo}
              onPlan={setDraft}
              onFinished={() => {
                onFinished?.(incident.id);
                onClose();
              }}
            />
          ) : (
            <div className={styles.navRow}>
              {waitingAnswer ? (
                <span className={styles.lockNote}>
                  Đang chờ {draft.assignedTo.fullName} trả lời: tạm khoá. Không liên lạc được thì bấm "Thu hồi
                  uỷ quyền" ở trên để chọn lại.
                </span>
              ) : departed || delegateTook ? (
                <button
                  type="button"
                  className={styles.btnBack}
                  disabled
                  title={
                    departed
                      ? 'Đã khởi hành: không quay lại bước trước được nữa'
                      : `${draft.assignedTo.fullName} đã nhận ca uỷ quyền: không quay lại bước trước được nữa`
                  }
                >
                  🔒 Quay lại bước trước
                </button>
              ) : (
                <button type="button" className={styles.btnBack} onClick={goBack}>
                  ← Quay lại bước trước
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* mounted only while open, so its layer is added after (above) this window */}
      {pickerOpen && (
        <LocationPicker
          open
          initial={destination}
          title="Chọn điểm đến (hiện trường)"
          onClose={() => setPickerOpen(false)}
          onPick={(p) => {
            setDestination({
              lat: p.lat,
              lng: p.lng,
              address: 'Vị trí chọn trên bản đồ (đang tìm địa chỉ...)',
              source: 'OFFICER_EDIT',
            });
            setPickerOpen(false);
            // Fill in the street address of the picked point (only if the officer has not moved it again)
            reverseGeocode(p)
              .then((address) =>
                setDestination((cur) =>
                  cur && cur.lat === p.lat && cur.lng === p.lng
                    ? { ...cur, address: address || 'Vị trí chọn trên bản đồ' }
                    : cur,
                ),
              )
              .catch(() =>
                setDestination((cur) =>
                  cur && cur.lat === p.lat && cur.lng === p.lng
                    ? { ...cur, address: 'Vị trí chọn trên bản đồ' }
                    : cur,
                ),
              );
          }}
        />
      )}
    </Modal>
  );
}

/**
 * Step 2 "Điều động" when my own unit goes: "Chỉ định người phụ trách" opens the list of my unit's officers
 * (the one who goes out with the GPS phone) and saves the choice; then the link (Zalo) for that person and
 * "Khởi hành" (EN_ROUTE: GPS taken from then on). The field officer can also press "Khởi hành" on the link.
 */
function OwnDispatchStep({ incidentId, plan, onPlan }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const picked = plan.tracker; // saved on the trip (status ACCEPTED, waiting to set off)
  // once the force has set off (or a simulation drives the route) the field officer cannot change any more
  const locked =
    plan.status === 'EN_ROUTE' ||
    plan.status === 'ARRIVED' ||
    plan.status === 'DONE' ||
    !!plan.simulation?.running;
  const [draftPick, setDraftPick] = useState(null);
  const [busy, setBusy] = useState(false);

  const choose = async () => {
    setBusy(true);
    try {
      const next = await changeFieldMember(incidentId, draftPick.memberId);
      onPlan(next);
      setOpen(false);
      toast.show(
        `${next?.tracker?.fullName || 'Đã chọn'} phụ trách hiện trường: bấm "Khởi hành" khi xuất phát`,
        {
          tone: 'success',
        },
      );
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={delegationStyles.card}>
      <div className={delegationStyles.cardHead}>
        <div className={delegationStyles.cardTitle}>Người phụ trách hiện trường *</div>
      </div>
      <div className={delegationStyles.meta}>
        Người ra hiện trường cầm điện thoại GPS; người báo tin thấy vị trí và gọi được cho người này.
      </div>
      {picked ? (
        <div className={styles.pickedOfficer}>
          <b>{picked.fullName}</b>
          {picked.badgeNumber && <span> · Số hiệu {picked.badgeNumber}</span>}
        </div>
      ) : (
        <div className={delegationStyles.meta}>Chưa chỉ định ai.</div>
      )}
      <button
        type="button"
        className={`${styles.btnGhost} ${styles.btnFull}`}
        disabled={locked}
        title={locked ? 'Lực lượng đã khởi hành: không đổi người phụ trách được nữa' : undefined}
        onClick={() => {
          setDraftPick(picked?.memberId ?? null);
          setOpen(true);
        }}
      >
        {locked
          ? '🔒 Đã khởi hành, không đổi người phụ trách'
          : picked
            ? 'Đổi người phụ trách'
            : 'Chỉ định người phụ trách'}
      </button>
      {picked && (
        <>
          <FieldLinkBox incidentId={incidentId} plan={plan} />
          <DepartButton who={picked.fullName} onDepart={() => departDelegation(incidentId)} onPlan={onPlan} />
        </>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          solid
          containerStyle={{ maxWidth: 480, width: 'min(480px, calc(100vw - 16px))' }}
          title={<span className={styles.confirmTitle}>Chỉ định người phụ trách hiện trường</span>}
        >
          <div className={styles.confirmBody}>
            <p>
              Ca <b>{plan ? incidentId : ''}</b> · {plan.origin.name}
            </p>
            <FieldOfficerPicker
              incidentId={incidentId}
              value={draftPick?.memberId ?? draftPick}
              onChange={(memberId, officer) => setDraftPick(officer || { memberId })}
              compact
            />
            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setOpen(false)}>
                Huỷ
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={!draftPick?.memberId || busy || draftPick.memberId === picked?.memberId}
                onClick={choose}
              >
                {busy ? 'Đang lưu...' : 'Chọn người này'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Where the force goes: the citizen's GPS, or a point the officer corrected (address / map). */
const SOURCE_LABEL = {
  CITIZEN_GPS: 'GPS người dân',
  OFFICER_EDIT: 'Cán bộ chỉnh',
  ROAD_SNAP: 'Xe dừng ở đường lớn',
};

/**
 * Citizen in an alley / small lane: suggest stopping the vehicle on the nearest main road (BE /geo/road-snap:
 * named road that is not a hẻm / kiệt / ngõ, OpenStreetMap; like Grab's pickup points). Only shown when that
 * point is more than 15 m from the citizen.
 * The officer can still pin any point with "Chọn trên bản đồ".
 */
function RoadSnapHint({ gps, destination, onChange }) {
  const [snap, setSnap] = useState({ key: null, value: null });
  const key = `${gps.lat.toFixed(5)},${gps.lng.toFixed(5)}`;
  useEffect(() => {
    let alive = true;
    getRoadSnap(gps)
      .then((v) => alive && setSnap({ key, value: v }))
      .catch(() => alive && setSnap({ key, value: null }));
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- gps changes with its key
  const s = snap.key === key ? snap.value : null;
  if (!s || s.distanceM < 15) return null;
  const used = destination?.source === 'ROAD_SNAP';
  const road = s.roadName || (s.big ? 'đường lớn' : 'đường xe vào được');
  return (
    <div className={used ? styles.snapUsed : styles.snapHint}>
      <span>
        {used ? 'Xe dừng ở ' : 'Xe khó vào? Dừng ở '}
        <b>{road}</b> · cách người báo {s.distanceM} m
        {!s.big && ' (không có đường lớn gần, đây là đường xe vào được gần nhất)'}
      </span>
      {!used && (
        <button
          type="button"
          className={styles.btnSmall}
          onClick={() =>
            onChange({
              lat: s.lat,
              lng: s.lng,
              address: s.roadName || 'Điểm dừng xe gần nhất',
              source: 'ROAD_SNAP',
            })
          }
        >
          Dùng điểm này
        </button>
      )}
    </div>
  );
}

function DestinationBox({ destination, original, typeLabel, onChange, onOpenPicker }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ status: 'idle', items: [], error: null });
  // Sender / time / phone / type / description can be folded away (remembered per browser)
  const [showBrief, setShowBriefState] = useState(() => {
    try {
      return localStorage.getItem(BRIEF_KEY) !== 'hidden';
    } catch {
      return true;
    }
  });
  const setShowBrief = (update) =>
    setShowBriefState((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      try {
        localStorage.setItem(BRIEF_KEY, next ? 'shown' : 'hidden');
      } catch {
        // storage blocked: the choice just lasts for this window
      }
      return next;
    });
  const gps = original.lat != null ? { lat: original.lat, lng: original.lng } : null;

  const search = async (e) => {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setResults({ status: 'loading', items: [], error: null });
    try {
      const items = await searchAddress(query, { near: gps });
      setResults({ status: 'ready', items, error: null });
    } catch (err) {
      setResults({ status: 'error', items: [], error: err.message });
    }
  };

  return (
    <section className={styles.box}>
      <div className={styles.boxHead}>
        <span className={styles.boxTitle}>Điểm đến (hiện trường)</span>
        <span className={destination?.source === 'CITIZEN_GPS' ? styles.chipGps : styles.chipEdit}>
          {SOURCE_LABEL[destination?.source] || 'GPS người dân'}
        </span>
      </div>
      <button
        type="button"
        className={styles.briefToggle}
        aria-expanded={showBrief}
        onClick={() => setShowBrief((v) => !v)}
      >
        {showBrief ? '▾ Ẩn thông tin người báo' : '▸ Hiện thông tin người báo'}
      </button>
      {showBrief && <CaseBrief incident={original} typeLabel={typeLabel} />}
      {destination ? (
        <>
          <div className={styles.destAddr}>{destination.address || 'Không có địa chỉ'}</div>
          <div className={styles.destCoord}>
            {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
            {destination.source === 'CITIZEN_GPS' && original.accuracy ? ` · ±${original.accuracy} m` : ''}
          </div>
        </>
      ) : (
        <div className={styles.warn}>Ca không có toạ độ: tìm địa chỉ hoặc chọn trên bản đồ.</div>
      )}
      {gps && <RoadSnapHint gps={gps} destination={destination} onChange={onChange} />}

      <form className={styles.searchRow} onSubmit={search}>
        <input
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Địa chỉ người dân cung cấp thêm..."
          aria-label="Tìm địa chỉ điểm đến"
        />
        <button type="submit" className={styles.btnSmall} disabled={query.trim().length < 3}>
          Tìm
        </button>
      </form>
      <div className={styles.destActions}>
        <button type="button" className={styles.linkBtn} onClick={onOpenPicker}>
          Chọn trên bản đồ
        </button>
        {gps && destination && destination.source !== 'CITIZEN_GPS' && (
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() =>
              onChange({
                ...gps,
                address: [original.address, original.ward, original.province].filter(Boolean).join(', '),
                source: 'CITIZEN_GPS',
              })
            }
          >
            Về GPS người dân
          </button>
        )}
      </div>
      {results.status === 'loading' && <div className={styles.muted}>Đang tìm...</div>}
      {results.status === 'error' && <div className={styles.warn}>{results.error}</div>}
      {results.status === 'ready' && results.items.length === 0 && (
        <div className={styles.muted}>Không tìm thấy địa chỉ này.</div>
      )}
      {results.items.length > 0 && (
        <ul className={styles.results}>
          {results.items.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onChange({ lat: r.lat, lng: r.lng, address: r.label, source: 'OFFICER_EDIT' });
                  setResults({ status: 'idle', items: [], error: null });
                  setQuery('');
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Province / PCCC / CSGT officers: pick the HQ or a ward station (ward police never see this). */
function OriginList({ stations, estimates, estimateError, selectedId, onSelect, hasDestination }) {
  return (
    <section className={`${styles.box} ${styles.originBox}`}>
      <div className={styles.boxHead}>
        <span className={styles.boxTitle}>Chọn điểm xuất phát ({stations.length})</span>
      </div>
      <div className={styles.muted}>
        Trụ sở tỉnh hiện tại hoặc cơ sở xã/phường trong địa bàn, sắp theo thời gian tới.
      </div>
      {!hasDestination && <div className={styles.muted}>Chọn điểm đến để tính quãng đường.</div>}
      {stations.length === 0 && (
        <div className={styles.warn}>Không có cơ sở nào của lực lượng này trong tỉnh.</div>
      )}
      {estimateError && (
        <div className={styles.muted}>
          Không tính được đường bộ ({estimateError}): đang ước lượng theo đường chim bay.
        </div>
      )}
      <ul className={styles.origins}>
        {stations.map((s, i) => {
          const e = estimates?.[s.id];
          const prevLevel = stations[i - 1]?.level;
          const groupTitle =
            i === 0 || (prevLevel !== 'ward') !== (s.level !== 'ward')
              ? s.level === 'ward'
                ? 'Cơ sở xã/phường'
                : 'Cơ sở hiện tại (tỉnh)'
              : null;
          return (
            <li key={s.id}>
              {groupTitle && <div className={styles.group}>{groupTitle}</div>}
              <button
                type="button"
                className={`${styles.origin} ${s.id === selectedId ? styles.originOn : ''}`}
                onClick={() => onSelect(s.id)}
              >
                <img
                  className={styles.originIcon}
                  src={STATION_ICON[s.agency] || STATION_ICON.police}
                  alt=""
                />
                <span className={styles.originMain}>
                  <span className={styles.originName}>{s.name}</span>
                  <span className={styles.originSub}>
                    {[LEVEL_LABEL[s.level], s.ward].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className={styles.originEta}>
                  {e ? (
                    <>
                      <b>{formatDuration(e.durationS)}</b>
                      <span>
                        {e.estimated ? '~' : ''}
                        {formatDistance(e.distanceM)}
                      </span>
                    </>
                  ) : (
                    hasDestination && <span>Đang tính...</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RouteSummary({ station, route, error }) {
  if (!station) return <div className={styles.summary}>Chọn một cơ sở để xem tuyến đường.</div>;
  return (
    <div className={styles.summary}>
      <div className={styles.summaryRow}>
        <img
          className={styles.summaryIcon}
          src={STATION_ICON[station.agency] || STATION_ICON.police}
          alt=""
        />
        <div className={styles.summaryMain}>
          <div className={styles.summaryName}>{station.name}</div>
          <div className={styles.summarySub}>{station.address || 'Chưa có địa chỉ'}</div>
        </div>
        <div className={styles.summaryEta}>
          <b>{route ? formatDuration(route.durationS) : '—'}</b>
          <span>
            {route?.estimated ? '~' : ''}
            {route ? formatDistance(route.distanceM) : ''}
          </span>
        </div>
      </div>
      {error && <div className={styles.warn}>Không vẽ được tuyến: {error}</div>}
      <div className={styles.delayNote}>{DELAY_NOTE}</div>
    </div>
  );
}

/** Steps 2-4 come in the next batches; for now show what step 1 saved. */
function ChosenSummary({ draft, canPickOrigin, locked = false, onEdit }) {
  const o = draft.origin;
  return (
    <div className={styles.chosen}>
      <div className={styles.box}>
        <div className={styles.boxHead}>
          <span className={styles.boxTitle}>
            {canPickOrigin ? 'Đã chọn điểm xuất phát' : 'Trụ sở xuất phát'}
          </span>
          {!locked && (
            <button type="button" className={styles.linkBtn} onClick={onEdit}>
              {canPickOrigin ? 'Đổi điểm xuất phát / điểm đến' : 'Đổi điểm đến'}
            </button>
          )}
        </div>
        <div className={styles.summaryRow}>
          <img className={styles.summaryIcon} src={STATION_ICON[o.agency] || STATION_ICON.police} alt="" />
          <div className={styles.summaryMain}>
            <div className={styles.summaryName}>{o.name}</div>
            <div className={styles.summarySub}>{o.address || 'Chưa có địa chỉ'}</div>
          </div>
          <div className={styles.summaryEta}>
            <b>{formatDuration(draft.route?.durationS)}</b>
            <span>{formatDistance(draft.route?.distanceM)}</span>
          </div>
        </div>
        <div className={styles.destCoord}>Điểm đến: {draft.destination?.address}</div>
      </div>
    </div>
  );
}

/** Who sent the SOS, when, how to call them, what happened (top of the destination box). */
function CaseBrief({ incident, typeLabel }) {
  const content = [incident.tags?.join(', '), incident.description].filter(Boolean).join(' — ');
  return (
    <dl className={styles.brief}>
      <dt>Người gửi</dt>
      <dd>{incident.citizenName || 'Không để tên'}</dd>
      <dt>Gửi lúc</dt>
      <dd>{incident.createdAt ? SENT_AT.format(incident.createdAt) : '—'}</dd>
      <dt>Điện thoại</dt>
      <dd>{incident.phone ? <a href={`tel:${incident.phone}`}>{incident.phone}</a> : 'Không có'}</dd>
      <dt>Loại hình</dt>
      <dd>{typeLabel || incident.type}</dd>
      <dt>Mô tả</dt>
      <dd>{content || 'Không có mô tả'}</dd>
    </dl>
  );
}
