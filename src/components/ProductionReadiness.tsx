import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, TrendingUp, Activity, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { productionReadinessService, type ReadinessReport, type ReadinessCheck } from '../lib/productionReadinessService';

export default function ProductionReadiness() {
  const { user } = useAuth();
  const [report, setReport] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      runCheck();
    }
  }, [user]);

  const runCheck = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await productionReadinessService.runFullCheck(user.id);
      setReport(result);
    } catch (error) {
      console.error('Error running readiness check:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ReadinessCheck['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusColor = (status: ReadinessCheck['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'fail':
        return 'bg-red-50 border-red-200';
      case 'checking':
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getOverallStatusColor = (status: 'ready' | 'partial' | 'not-ready') => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'not-ready':
        return 'bg-red-100 text-red-800 border-red-300';
    }
  };

  const getOverallStatusIcon = (status: 'ready' | 'partial' | 'not-ready') => {
    switch (status) {
      case 'ready':
        return <Award className="w-8 h-8 text-green-600" />;
      case 'partial':
        return <Activity className="w-8 h-8 text-yellow-600" />;
      case 'not-ready':
        return <AlertCircle className="w-8 h-8 text-red-600" />;
    }
  };

  const getOverallStatusMessage = (status: 'ready' | 'partial' | 'not-ready') => {
    switch (status) {
      case 'ready':
        return 'System is production-ready';
      case 'partial':
        return 'System needs attention before production';
      case 'not-ready':
        return 'Critical issues must be resolved';
    }
  };

  const categories = report
    ? Array.from(new Set(report.checks.map((c) => c.category)))
    : [];

  const filteredChecks = selectedCategory
    ? report?.checks.filter((c) => c.category === selectedCategory)
    : report?.checks;

  const categoryStats = categories.map((cat) => {
    const checks = report!.checks.filter((c) => c.category === cat);
    const pass = checks.filter((c) => c.status === 'pass').length;
    const warning = checks.filter((c) => c.status === 'warning').length;
    const fail = checks.filter((c) => c.status === 'fail').length;
    return { category: cat, pass, warning, fail, total: checks.length };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-lg text-gray-600">Running production readiness check...</span>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Failed to load readiness report</p>
        <button
          onClick={runCheck}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Production Readiness</h2>
        <button
          onClick={runCheck}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" />
          Re-run Check
        </button>
      </div>

      <div className={`border-2 rounded-lg p-6 ${getOverallStatusColor(report.overallStatus)}`}>
        <div className="flex items-center gap-4">
          {getOverallStatusIcon(report.overallStatus)}
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-1">
              {getOverallStatusMessage(report.overallStatus)}
            </h3>
            <p className="text-sm opacity-90">
              Readiness Score: {report.score}%
            </p>
            <p className="text-xs opacity-75 mt-1">
              Last checked: {new Date(report.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{report.score}%</div>
            <div className="text-sm opacity-75">Ready</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Checks</span>
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{report.checks.length}</div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-600">Passed</span>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {report.checks.filter((c) => c.status === 'pass').length}
          </div>
        </div>

        <div className="bg-white border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-yellow-600">Warnings</span>
            <AlertCircle className="w-4 h-4 text-yellow-600" />
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {report.checks.filter((c) => c.status === 'warning').length}
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-red-600">Failed</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            {report.checks.filter((c) => c.status === 'fail').length}
          </div>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {report.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-blue-800">
                <span className="text-blue-600 mt-1">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Check Categories</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg border transition-colors ${
              selectedCategory === null
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            All ({report.checks.length})
          </button>
          {categoryStats.map((stat) => (
            <button
              key={stat.category}
              onClick={() => setSelectedCategory(stat.category)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedCategory === stat.category
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {stat.category}
              <span className="ml-2 text-xs opacity-75">
                ({stat.pass}/{stat.total})
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredChecks?.map((check, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 ${getStatusColor(check.status)}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusIcon(check.status)}</div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h4 className="font-semibold text-gray-900">{check.name}</h4>
                      <p className="text-sm text-gray-600">{check.category}</p>
                    </div>
                    {check.metric !== undefined && check.threshold !== undefined && (
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">
                          {check.metric.toFixed(1)}
                          {check.name.includes('Rate') || check.name.includes('Connectivity') ? '%' : ''}
                        </div>
                        <div className="text-xs text-gray-500">
                          Target: {check.threshold}
                          {check.name.includes('Rate') || check.name.includes('Connectivity') ? '%' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1">{check.message}</p>
                  {check.details && (
                    <p className="text-xs text-gray-600">{check.details}</p>
                  )}
                  {check.metric !== undefined && check.threshold !== undefined && (
                    <div className="mt-2 bg-white bg-opacity-50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          check.status === 'pass'
                            ? 'bg-green-500'
                            : check.status === 'warning'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (check.metric / check.threshold) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Next Steps</h3>
        <div className="space-y-2 text-sm text-gray-700">
          {report.overallStatus === 'ready' ? (
            <>
              <p>✓ System has passed production readiness checks</p>
              <p>✓ Review recommendations above for optimization opportunities</p>
              <p>✓ Proceed to DEPLOYMENT-READINESS-CHECKLIST.md for cutover planning</p>
              <p>✓ Schedule team training and user communications</p>
              <p>✓ Plan gradual transition from legacy system</p>
            </>
          ) : report.overallStatus === 'partial' ? (
            <>
              <p>⚠ Address warnings to improve system reliability</p>
              <p>⚠ Review failed checks and resolve critical issues</p>
              <p>⚠ Re-run this check after making improvements</p>
              <p>⚠ Consult TROUBLESHOOTING-GUIDE.md for common solutions</p>
            </>
          ) : (
            <>
              <p>✗ Critical issues must be resolved before production</p>
              <p>✗ Focus on failed checks first, then warnings</p>
              <p>✗ Contact support if you need assistance</p>
              <p>✗ Do not proceed with cutover until issues are resolved</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
