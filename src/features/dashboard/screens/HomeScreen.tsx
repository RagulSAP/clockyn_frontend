import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { companyApi } from "@/api";
import { Screen } from "@/components/layout";
import {
  EmptyState,
  LoadingOverlay,
  SkeletonList,
  Text,
  useToast,
  Reveal,
} from "@/components/ui";
import { useOrgPlan, useRefreshOnFocus } from "@/hooks";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { getErrorMessage } from "@/lib/api/errors";
import { routes, useAppRouter } from "@/lib/navigation";
import { queryKeys } from "@/lib/query/queryKeys";
import { useOrgId, useUserId } from "@/store/auth";
import { spacing } from "@/theme";
import type { Branch } from "@/types/api/branches";
import type { Company } from "@/types/api/company";
import type { DepartmentStats } from "@/types/api/home";

import { CompanySwitcherSheet } from "../components/CompanySwitcherSheet";
import { DashboardOverlays } from "../components/DashboardOverlays";
import { DepartmentCard } from "../components/DepartmentCard";
import { FilterBar } from "../components/FilterBar";
import { LogoViewer } from "../components/LogoViewer";
import { OrgHeader } from "../components/OrgHeader";
import { PlanExpiryModal } from "../components/PlanExpiryModal";
import { ManageCards, type ManageEntity } from "../components/ManageCards";
import { QuickActions } from "../components/QuickActions";
import { SummaryCard } from "../components/SummaryCard";
import { useCompanySwitch } from "../hooks/useCompanySwitch";
import {
  useBranches,
  useCompanyName,
  useDashboardStats,
  useDepartments,
  useDepartmentStats,
  useOrgLogo,
  usePendingRequests,
} from "../hooks/useDashboardQueries";
import { useDashboardFilters } from "../hooks/useDashboardFilters";
import { usePlanActivatedToast } from "../hooks/usePlanActivatedToast";
import { usePlanExpiryPopup } from "../hooks/usePlanExpiryPopup";
import { useQueryErrorToast } from "../hooks/useQueryErrorToast";
import {
  departmentKey,
  hasNoAttendanceData,
  overviewParams,
  staffListParams,
  type StaffFilter,
} from "../utils/dashboardLogic";
import { renewParams } from "../utils/planPopup";

const NO_BRANCHES: readonly Branch[] = [];

/** Admin dashboard (tab root of `/admin/home`). */
export default function HomeScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  const userId = useUserId();
  const { isDesktop, isPhone } = useBreakpoint();
  const params = useLocalSearchParams<{ welcomeMessage?: string }>();
  const welcomeMessage = Array.isArray(params.welcomeMessage)
    ? params.welcomeMessage[0]
    : params.welcomeMessage;

  const filters = useDashboardFilters(orgId);
  const { date, deptOn, today } = filters;

  const branchesQuery = useBranches(orgId);
  const branches = branchesQuery.data ?? NO_BRANCHES;
  // A branch that no longer exists (deleted elsewhere) falls back to ALL.
  const branchId =
    filters.branchId !== "" &&
    branchesQuery.data &&
    !branchesQuery.data.some((b) => b.id === filters.branchId)
      ? ""
      : filters.branchId;

  const stats = useDashboardStats(orgId, date, branchId);
  const departments = useDepartmentStats(orgId, date, branchId, deptOn);
  const departmentList = useDepartments(orgId);
  const logo = useOrgLogo(orgId);
  const companyName = useCompanyName(orgId);
  const pending = usePendingRequests(orgId);
  const plan = useOrgPlan();
  const planPopup = usePlanExpiryPopup();
  usePlanActivatedToast();

  useQueryErrorToast(stats.error, "Failed to load dashboard data");
  useQueryErrorToast(departments.error, "Department data not available");

  const noData =
    !stats.isPlaceholderData && hasNoAttendanceData(stats.data, date, today);

  // ── welcome toast (after registration) ───────────────────────────────────────
  useEffect(() => {
    if (!welcomeMessage) return undefined;
    const t = setTimeout(() => toast.success(welcomeMessage), 500);
    return () => clearTimeout(t);
  }, [welcomeMessage, toast]);

  // ── refresh: pull-to-refresh and returning from edit / payment screens ──────
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.home.all(orgId) }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.requests.pendingCounts(orgId),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.company.all(orgId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.all(orgId) }),
    ]);
  }, [queryClient, orgId]);
  useRefreshOnFocus(refreshAll);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      filters.resetDate();
      await refreshAll();
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to refresh data"));
    } finally {
      setRefreshing(false);
    }
  }, [filters, refreshAll, toast]);

  // ── company switcher ─────────────────────────────────────────────────────────
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const companies = useQuery({
    queryKey: queryKeys.company.list(userId),
    queryFn: () => companyApi.listCompanies(userId),
    enabled: switcherOpen && userId !== "",
    staleTime: 0,
  });
  useQueryErrorToast(companies.error, "Failed to load companies");
  const { switchingTo, switchTo } = useCompanySwitch();

  const onSelectCompany = useCallback(
    async (company: Company) => {
      setSwitcherOpen(false);
      await switchTo(company, date);
    },
    [switchTo, date],
  );

  // ── navigation ───────────────────────────────────────────────────────────────
  const openStaffList = useCallback(
    (filter: StaffFilter) =>
      router.push(
        routes.admin.staff.list,
        staffListParams({ filter, branchId, date }),
      ),
    [router, branchId, date],
  );
  const openDepartmentStaff = useCallback(
    (dept: DepartmentStats, filter: StaffFilter) =>
      router.push(
        routes.admin.staff.list,
        staffListParams({ filter, branchId, date, deptId: dept.deptId }),
      ),
    [router, branchId, date],
  );
  const openOverview = useCallback(
    () =>
      router.push(routes.admin.overview, overviewParams({ date, branchId })),
    [router, date, branchId],
  );

  const staffLocationBlocked = plan.isBlocked("staff_location");
  const onStaffLocation = useCallback(() => {
    if (plan.isBlocked("staff_location")) {
      toast.info(plan.message("staff_location"));
      return;
    }
    router.push(routes.admin.location, { date });
  }, [plan, toast, router, date]);

  const manageItems = useMemo<ManageEntity[]>(
    () => [
      // View Staff opens the whole roster (v1 passed no branch).
      {
        key: "staff",
        icon: "users",
        title: "Staff",
        noun: "on roll",
        count: stats.data ? stats.data.totalStaff : null,
        viewLabel: "View Staff",
        addLabel: "Add Staff",
        onView: () =>
          router.push(
            routes.admin.staff.list,
            staffListParams({ filter: "total", date }),
          ),
        onAdd: () => router.push(routes.admin.staff.edit),
      },
      {
        key: "branch",
        icon: "building-2",
        title: "Branches",
        noun: branchesQuery.data?.length === 1 ? "location" : "locations",
        count: branchesQuery.data ? branchesQuery.data.length : null,
        viewLabel: "View Branch",
        addLabel: "Add Branch",
        onView: () => router.push(routes.admin.branches.list),
        onAdd: () => router.push(routes.admin.branches.edit),
      },
      {
        key: "dept",
        icon: "layers",
        title: "Departments",
        noun: departmentList.data?.length === 1 ? "team" : "teams",
        count: departmentList.data ? departmentList.data.length : null,
        viewLabel: "View Dept",
        addLabel: "Add Dept",
        onView: () => router.push(routes.admin.departments.list),
        onAdd: () => router.push(routes.admin.departments.edit),
      },
    ],
    [router, date, stats.data, branchesQuery.data, departmentList.data],
  );

  // ── plan popup actions ───────────────────────────────────────────────────────
  const onPlanPrimary = useCallback(() => {
    const current = planPopup.popup;
    planPopup.dismiss();
    if (!current) return;
    const renew =
      current.type === "trial_expiring"
        ? null
        : renewParams(current.subscription);
    if (renew) router.push(routes.admin.billing.upgrade, renew);
    else router.push(routes.admin.billing.overview);
  }, [planPopup, router]);

  const summary = (
    <Reveal index={1}>
      <SummaryCard
        stats={stats.data}
        loading={stats.isLoading}
        error={
          stats.error
            ? getErrorMessage(stats.error, "Failed to load dashboard data")
            : null
        }
        onRetry={() => void stats.refetch()}
        noData={noData}
        onFigurePress={openStaffList}
        onOpenOverview={openOverview}
      />
    </Reveal>
  );

  const departmentView = noData ? null : departments.isLoading ? (
    <View style={{ gap: spacing.md }}>
      <Text variant="callout" color="textMuted" align="center">
        Loading departments...
      </Text>
      <SkeletonList variant="card" count={2} />
    </View>
  ) : departments.data && departments.data.length > 0 ? (
    <View
      style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
      testID="department-list"
    >
      {departments.data.map((dept, i) => (
        <View
          key={departmentKey(dept, i)}
          style={{ flexGrow: 1, flexBasis: isPhone ? "100%" : 320 }}
        >
          <DepartmentCard dept={dept} onStatPress={openDepartmentStaff} />
        </View>
      ))}
    </View>
  ) : (
    <EmptyState compact icon="layers" title="No department data available" />
  );

  const quickActions = (
    <Reveal index={2}>
      <QuickActions
        pendingRequests={pending.data?.total ?? 0}
        staffLocationLocked={staffLocationBlocked}
        onStaffLocation={onStaffLocation}
        onReports={() => router.push(routes.admin.reports.hub)}
        onRequests={() => router.push(routes.admin.requests.hub)}
      />
    </Reveal>
  );

  return (
    <Screen
      hideBack
      edges={["top"]}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      header={
        <OrgHeader
          companyName={companyName}
          logoUrl={logo.data}
          onPressCompany={() => router.push(routes.admin.company.view)}
          onPressLogo={() => setLogoOpen(true)}
          onSwitchCompany={() => setSwitcherOpen(true)}
          onRefresh={() => void onRefresh()}
          refreshing={refreshing}
        />
      }
      testID="admin-home"
    >
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <FilterBar
            branches={branches}
            branchId={branchId}
            onBranchChange={filters.setBranchId}
            deptOn={deptOn}
            onDeptChange={filters.setDeptOn}
            date={date}
            maxDate={today}
            onDateChange={filters.setDate}
          />
        </Reveal>

        {deptOn ? (
          <>
            {summary}
            {departmentView}
          </>
        ) : isDesktop ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.xl,
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 3, gap: spacing.xl }}>
              {summary}
              {quickActions}
            </View>
            <View style={{ flex: 2 }}>
              <ManageCards items={manageItems} />
            </View>
          </View>
        ) : (
          <>
            {summary}
            {quickActions}
            <ManageCards items={manageItems} />
          </>
        )}
      </View>

      <CompanySwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        companies={companies.data}
        loading={companies.isLoading}
        error={
          companies.error
            ? getErrorMessage(companies.error, "Failed to load companies")
            : null
        }
        onRetry={() => void companies.refetch()}
        currentOrgId={orgId}
        onSelect={(c) => void onSelectCompany(c)}
        onAddCompany={() => {
          setSwitcherOpen(false);
          router.push(routes.admin.company.edit);
        }}
      />
      <LogoViewer
        visible={logoOpen}
        uri={logo.data}
        onClose={() => setLogoOpen(false)}
      />
      <LoadingOverlay
        visible={switchingTo !== null}
        message={switchingTo ? `Switching to ${switchingTo}...` : undefined}
      />
      <PlanExpiryModal
        type={planPopup.popup?.type ?? null}
        endDate={planPopup.popup?.endDate ?? ""}
        onPrimary={onPlanPrimary}
        onDismiss={planPopup.dismiss}
      />
      <DashboardOverlays />
    </Screen>
  );
}
