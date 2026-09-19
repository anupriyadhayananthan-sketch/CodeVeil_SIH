import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

import { HomePage } from './screens/HomePage';
import { UserProfilePage } from './screens/UserProfilePage';
import { AboutPage } from './screens/AboutPage';
import { SettingsPage } from './screens/SettingsPage';
import { TenderUploadPage } from './screens/TenderUploadPage';
import { RequirementMatrixPage } from './screens/RequirementMatrixPage';
import { BidderComparisonPage } from './screens/BidderComparisonPage';
import { OfficerDecisionPage } from './screens/OfficerDecisionPage';
import { AuditTrailPage } from './screens/AuditTrailPage';
import { ReportExportPage } from './screens/ReportExportPage';
import { RiskCollusionPage } from './screens/RiskCollusionPage';
import { AccuracyTestingPage } from './screens/AccuracyTestingPage';

/** Full-screen loading overlay shown while the silent demo session is being established. */
const InitializingScreen = () => {
  const { isDark } = useTheme();
  return (
    <div className={`min-h-screen flex flex-col items-center justify-center gap-5 transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Animated spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-blue-200 dark:border-slate-700" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-black text-slate-700 dark:text-slate-300 tracking-wide uppercase">
          Establishing Secure Session…
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">
          CPCL GeM Tender Compliance Platform
        </p>
      </div>
    </div>
  );
};

const MainLayout = () => {
  const { initializing } = useAuth();
  const { isDark } = useTheme();

  const [currentTab, setCurrentTab] = useState('home');
  const [selectedTenderId, setSelectedTenderId] = useState(1);

  // Show spinner while the silent auto-login is in progress.
  if (initializing) {
    return <InitializingScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">

      {/* Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
      />

      <div className="flex flex-1">

        {/* Sidebar */}
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-12 transition-colors duration-200 bg-slate-100 dark:bg-slate-950/90">

          {currentTab === 'home' && (
            <HomePage
              setCurrentTab={setCurrentTab}
              setSelectedTenderId={setSelectedTenderId}
            />
          )}

          {currentTab === 'tender-upload' && (
            <TenderUploadPage
              setCurrentTab={setCurrentTab}
            />
          )}

          {currentTab === 'requirement-matrix' && (
            <RequirementMatrixPage
              selectedTenderId={selectedTenderId}
            />
          )}

          {currentTab === 'bidder-comparison' && (
            <BidderComparisonPage
              setCurrentTab={setCurrentTab}
              setSelectedTenderId={setSelectedTenderId}
            />
          )}

          {currentTab === 'officer-decision' && (
            <OfficerDecisionPage
              selectedTenderId={selectedTenderId}
            />
          )}

          {currentTab === 'risk-collusion' && (
            <RiskCollusionPage />
          )}

          {currentTab === 'audit-trail' && (
            <AuditTrailPage />
          )}

          {currentTab === 'report-export' && (
            <ReportExportPage
              selectedTenderId={selectedTenderId}
            />
          )}

          {currentTab === 'accuracy-testing' && (
            <AccuracyTestingPage />
          )}

          {currentTab === 'about' && (
            <AboutPage />
          )}

          {currentTab === 'settings' && (
            <SettingsPage />
          )}

          {currentTab === 'profile' && (
            <UserProfilePage />
          )}

        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
}