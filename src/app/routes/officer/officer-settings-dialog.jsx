/**
 * Officer console "Cài đặt" window (rail gear button): composes the settings sections of several
 * features (auth, incident-queue, unit-settings, account-admin), which may not import each other.
 *   Tài khoản : profile (read-only /auth/me), security (change password: unit commander / old-style
 *               account; change PIN: officer of a unit account)
 *   Sự cố     : closed-case history (documents, detail)
 *   Đơn vị    : officer status (online / holding a case, hand over), officers & duty officer (unit account)
 *   Quản trị  : create account, export accounts to Excel (ADMIN)
 * The old rail buttons "Cán bộ", "Hồ sơ" and the "Lịch sử" tile now live here.
 */
import { useMemo } from 'react';

import {
  SettingsButton,
  SettingsDialog,
  SettingsFill,
  SettingsRow,
  SettingsSection,
} from '@/components/ui/settings-dialog/settings-dialog';
import { ExportAccountsPanel } from '@/features/account-admin';
import { OfficerInfoPanel } from '@/features/auth';
import { IncidentHistoryPanel, OfficerStatusPanel } from '@/features/incident-queue';
import { UnitSettingsPage } from '@/features/unit-settings';

/**
 * @param {{
 *   open: boolean, onClose: () => void, user: object, officer: object,
 *   onChangePassword: () => void, onChangePin: () => void, onCreateAccount: () => void,
 *   holding: object | null,            incident this officer holds (officer status: hand over)
 *   onIncidentChange: (inc) => void,   queue.upsert after a hand-over
 *   onOpenDetail: (id) => void, onOpenDocument: (id) => void, onHistoryAction: () => void,
 *   historyKey: number,                bump to reload the history after a document changes
 * }} props
 */
export function OfficerSettingsDialog({
  open,
  onClose,
  user,
  officer,
  onChangePassword,
  onChangePin,
  onCreateAccount,
  holding,
  onIncidentChange,
  onOpenDetail,
  onOpenDocument,
  onHistoryAction,
  historyKey,
}) {
  const member = user?.member || null;
  const canChangePassword = !member || member.unit_role === 'COMMANDER';

  const groups = useMemo(() => {
    const list = [
      {
        label: 'Tài khoản',
        items: [
          {
            id: 'profile',
            hidden: true, // opened by the profile card on top of the list
            icon: 'user',
            color: 'blue',
            label: 'Hồ sơ',
            keywords: 'thông tin đơn vị email số điện thoại địa chỉ trụ sở',
            render: () => (
              <>
                {member && (
                  <SettingsSection title="Cán bộ đang trực">
                    <SettingsRow
                      title={officer.fullName}
                      desc={[officer.roleLabel, member.badge_number && `Số hiệu ${member.badge_number}`]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </SettingsSection>
                )}
                <SettingsSection title={member ? 'Tài khoản đơn vị' : 'Hồ sơ tài khoản'}>
                  <OfficerInfoPanel user={user} unitName={officer.unitName} />
                </SettingsSection>
              </>
            ),
          },
          {
            id: 'security',
            icon: 'lock',
            color: 'blue',
            label: 'Bảo mật',
            keywords: 'mật khẩu PIN đăng nhập',
            render: () => (
              <SettingsSection title="Bảo mật">
                <SettingsRow
                  title="Mật khẩu"
                  desc={
                    !canChangePassword
                      ? 'Chỉ chỉ huy đơn vị đổi được mật khẩu tài khoản đơn vị.'
                      : member
                        ? 'Mật khẩu tài khoản đơn vị. Đổi xong mọi cán bộ của đơn vị phải đăng nhập lại.'
                        : 'Mật khẩu đăng nhập của tài khoản này.'
                  }
                >
                  {canChangePassword && (
                    <SettingsButton onClick={onChangePassword}>Đổi mật khẩu</SettingsButton>
                  )}
                </SettingsRow>
                {member && (
                  <SettingsRow
                    title="Mã PIN"
                    desc="PIN cá nhân để vào trực (4–6 số). Đổi xong phải vào trực lại."
                  >
                    <SettingsButton onClick={onChangePin}>Đổi mã PIN</SettingsButton>
                  </SettingsRow>
                )}
              </SettingsSection>
            ),
          },
        ],
      },
      {
        label: 'Sự cố',
        items: [
          {
            id: 'history',
            icon: 'file',
            color: 'amber',
            label: 'Lịch sử sự cố',
            keywords: 'ca đã điều phối đã đóng văn bản báo cáo tra cứu',
            render: () => (
              <SettingsFill>
                <IncidentHistoryPanel
                  agency={officer.agency}
                  onExportExcel={onHistoryAction}
                  onClear={onHistoryAction}
                  onOpenDetail={onOpenDetail}
                  onOpenDocument={onOpenDocument}
                  refreshKey={historyKey}
                />
              </SettingsFill>
            ),
          },
        ],
      },
      {
        label: 'Đơn vị',
        items: [
          {
            id: 'officers',
            icon: 'users',
            color: 'blue',
            label: 'Trạng thái cán bộ',
            keywords: 'trực tuyến ngoại tuyến đang giữ ca giao ca',
            render: () => (
              <SettingsFill>
                <OfficerStatusPanel
                  holding={holding}
                  onChange={onIncidentChange}
                  isAdmin={officer.isAdmin}
                  provinceScope={officer.level === 'province' ? user?.province_id : null}
                />
              </SettingsFill>
            ),
          },
          ...(member
            ? [
                {
                  id: 'unit',
                  icon: 'users',
                  color: 'purple',
                  label: 'Cán bộ & trực ban',
                  keywords: 'danh sách cán bộ trực ban giao trực cấp lại PIN thêm cán bộ',
                  render: () => <UnitSettingsPage me={user} embedded />,
                },
              ]
            : []),
        ],
      },
    ];

    if (officer.isAdmin) {
      list.push({
        label: 'Quản trị',
        items: [
          {
            id: 'create-account',
            icon: 'shield',
            color: 'purple',
            label: 'Tạo tài khoản',
            keywords: 'phân quyền cán bộ quản trị đơn vị',
            render: () => (
              <SettingsSection title="Tạo tài khoản">
                <SettingsRow
                  title="Tài khoản đơn vị / quản trị"
                  desc="Tạo tài khoản cho đơn vị (công an, CSGT, PCCC, y tế) hoặc quản trị viên. Tạo xong hệ thống trả mã kích hoạt cho chỉ huy đầu tiên."
                >
                  <SettingsButton variant="primary" onClick={onCreateAccount}>
                    Mở trang tạo tài khoản
                  </SettingsButton>
                </SettingsRow>
              </SettingsSection>
            ),
          },
          {
            id: 'export-accounts',
            icon: 'file',
            color: 'amber',
            label: 'Xuất danh sách tài khoản',
            keywords: 'excel xlsx tải xuống export cán bộ',
            render: () => <ExportAccountsPanel />,
          },
        ],
      });
    }
    return list;
  }, [
    member,
    canChangePassword,
    officer,
    user,
    onChangePassword,
    onChangePin,
    onCreateAccount,
    holding,
    onIncidentChange,
    onOpenDetail,
    onOpenDocument,
    onHistoryAction,
    historyKey,
  ]);

  // same avatar / name / role line as the console header; tapping it opens "Hồ sơ"
  const profile = {
    initials: initials(officer.fullName),
    name: officer.fullName,
    sub: officer.isAdmin ? 'Quản trị hệ thống' : `${officer.roleLabel || 'Cán bộ'} · Đang trực tuyến`,
    itemId: 'profile',
  };

  return <SettingsDialog open={open} onClose={onClose} groups={groups} profile={profile} />;
}

/** "Hoàng Minh Kiên" -> "HK" (first letter of the first and last word), like the header avatar. */
function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CB';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}
