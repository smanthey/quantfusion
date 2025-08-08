import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, BarChart3, TrendingUp, Pause, Play, Trophy } from 'lucide-react';

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  variants: ABTestVariant[];
  trafficSplit: number[];
  metrics: string[];
  startDate: string;
  endDate?: string;
}

interface ABTestVariant {
  id: string;
  name: string;
  config: any;
  description: string;
}

interface ABTestResult {
  testId: string;
  variantId: string;
  metrics: { [key: string]: number };
  sampleSize: number;
  confidence: number;
  statisticalSignificance: boolean;
}

export default function ABTestingPage() {
  const { data: testsData } = useQuery({
    queryKey: ['/api/ab-testing/tests'],
    refetchInterval: 5000,
  });

  const { data: resultsData } = useQuery({
    queryKey: ['/api/ab-testing/results'],
    refetchInterval: 5000,
  });

  const { data: reportData } = useQuery({
    queryKey: ['/api/ab-testing/report'],
    refetchInterval: 10000,
  });

  const tests: ABTest[] = testsData?.tests || [];
  const results: { [testId: string]: ABTestResult[] } = resultsData?.results || {};

  const pauseTest = async (testId: string) => {
    await fetch(`/api/ab-testing/tests/${testId}/pause`, { method: 'POST' });
    window.location.reload();
  };

  const resumeTest = async (testId: string) => {
    await fetch(`/api/ab-testing/tests/${testId}/resume`, { method: 'POST' });
    window.location.reload();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatMetricName = (metric: string) => {
    return metric.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Systematic optimization through automated testing of multiple trading parameters
          </p>
        </div>
        <Badge variant="outline" className="bg-blue-50">
          <Activity className="w-4 h-4 mr-2" />
          {tests.filter(t => t.status === 'running').length} Active Tests
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Test Overview</TabsTrigger>
          <TabsTrigger value="results">Detailed Results</TabsTrigger>
          <TabsTrigger value="report">Performance Report</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {tests.map((test) => {
              const testResults = results[test.id] || [];
              const hasResults = testResults.length > 0;
              const winner = hasResults ? testResults.reduce((best, current) => 
                (current.metrics.winRate || 0) > (best.metrics.winRate || 0) ? current : best
              ) : null;

              return (
                <Card key={test.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {test.name}
                        <Badge className={getStatusColor(test.status)}>
                          {test.status.toUpperCase()}
                        </Badge>
                      </CardTitle>
                      <div className="flex gap-2">
                        {test.status === 'running' ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => pauseTest(test.id)}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : test.status === 'paused' ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => resumeTest(test.id)}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <CardDescription>{test.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {test.variants.map((variant, index) => {
                        const variantResult = testResults.find(r => r.variantId === variant.id);
                        const isWinner = winner && winner.variantId === variant.id && winner.statisticalSignificance;
                        
                        return (
                          <div key={variant.id} className={`p-3 rounded-lg border ${isWinner ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-sm">{variant.name}</h4>
                              {isWinner && <Trophy className="w-4 h-4 text-yellow-500" />}
                            </div>
                            
                            <div className="text-xs text-muted-foreground mb-2">
                              {variant.description}
                            </div>
                            
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>Traffic Split:</span>
                                <span>{test.trafficSplit[index]}%</span>
                              </div>
                              
                              {variantResult && (
                                <>
                                  <div className="flex justify-between text-xs">
                                    <span>Samples:</span>
                                    <span>{variantResult.sampleSize}</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span>Win Rate:</span>
                                    <span>{((variantResult.metrics.winRate || 0) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-xs">
                                    <span>Total P&L:</span>
                                    <span className={variantResult.metrics.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                                      ${variantResult.metrics.totalPnL.toFixed(2)}
                                    </span>
                                  </div>
                                  {variantResult.statisticalSignificance && (
                                    <div className="flex justify-between text-xs">
                                      <span>Confidence:</span>
                                      <span className="text-green-600 font-medium">
                                        {(variantResult.confidence * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {hasResults && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between text-sm">
                          <span>Test Progress:</span>
                          <span>{Math.max(...testResults.map(r => r.sampleSize))} samples</span>
                        </div>
                        <Progress 
                          value={Math.min(Math.max(...testResults.map(r => r.sampleSize)) / 100 * 100, 100)} 
                          className="h-2 mt-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {tests.map((test) => {
            const testResults = results[test.id] || [];
            if (testResults.length === 0) return null;

            return (
              <Card key={test.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    {test.name} - Detailed Results
                  </CardTitle>
                  <CardDescription>
                    Statistical analysis and performance metrics comparison
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {testResults.map((result) => {
                      const variant = test.variants.find(v => v.variantId === result.variantId);
                      
                      return (
                        <div key={result.variantId} className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{variant?.name || result.variantId}</h4>
                            <Badge variant={result.statisticalSignificance ? "default" : "secondary"}>
                              {result.statisticalSignificance ? 'Significant' : 'Pending'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(result.metrics).map(([metric, value]) => (
                              <div key={metric} className="text-center p-3 bg-gray-50 rounded">
                                <div className="text-2xl font-bold">
                                  {typeof value === 'number' ? (
                                    metric.includes('Rate') || metric.includes('rate') ? 
                                    `${(value * 100).toFixed(1)}%` :
                                    metric.includes('PnL') || metric.includes('pnl') ?
                                    `$${value.toFixed(2)}` :
                                    value.toFixed(2)
                                  ) : value}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatMetricName(metric)}
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Sample Size: {result.sampleSize} | 
                            Confidence: {(result.confidence * 100).toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="report" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Comprehensive A/B Testing Report
              </CardTitle>
              <CardDescription>
                Generated at {reportData?.timestamp ? new Date(reportData.timestamp).toLocaleString() : 'Loading...'}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {reportData?.report ? (
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                  {reportData.report}
                </pre>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading comprehensive report...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}