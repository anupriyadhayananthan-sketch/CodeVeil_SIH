import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';

import { LoginPage } from './screens/LoginPage';
import { SignupPage } from './screens/SignupPage';
import { ForgotPasswordPage } from './screens/ForgotPasswordPage';
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

const MainLayout = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedTenderId, setSelectedTenderId] = useState(1);

  // Unauthenticated screens
  if (!user && (currentTab === 'login' || currentTab === 'signup' || currentTab === 'forgot-password')) {
    return (
      <div className="min-h-screen transition-colors duration-200 bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />
        {currentTab === 'login' && <LoginPage setCurrentTab={setCurrentTab} />}
        {currentTab === 'signup' && <SignupPage setCurrentTab={setCurrentTab} />}
        {currentTab === 'forgot-password' && <ForgotPasswordPage setCurrentTab={setCurrentTab} />}
      </div>
    );
  }

  // If user is not logged in, show login page by default
  if (!user) {
    return (
      <div className="min-h-screen transition-colors duration-200 bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Header currentTab="login" setCurrentTab={setCurrentTab} />
        <LoginPage setCurrentTab={setCurrentTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200 bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />
      
      <div className="flex flex-1">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main className="flex-1 overflow-y-auto pb-12 transition-colors duration-200 bg-slate-100 dark:bg-slate-950/90">
          {currentTab === 'home' && (
            <HomePage setCurrentTab={setCurrentTab} setSelectedTenderId={setSelectedTenderId} />
          )}
          {currentTab === 'tender-upload' && (
            <TenderUploadPage setCurrentTab={setCurrentTab} />
          )}
          {currentTab === 'requirement-matrix' && (
            <RequirementMatrixPage selectedTenderId={selectedTenderId} />
          )}
          {currentTab === 'bidder-comparison' && (
            <BidderComparisonPage setCurrentTab={setCurrentTab} setSelectedTenderId={setSelectedTenderId} />
          )}
          {currentTab === 'officer-decision' && (
            <OfficerDecisionPage selectedTenderId={selectedTenderId} />
          )}
          {currentTab === 'risk-collusion' && (
            <RiskCollusionPage />
          )}
          {currentTab === 'audit-trail' && (
            <AuditTrailPage />
          )}
          {currentTab === 'report-export' && (
            <ReportExportPage selectedTenderId={selectedTenderId} />
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
