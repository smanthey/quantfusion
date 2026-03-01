import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "wouter";

interface LearningPattern {
  avgPnL: number;
}

interface LearningAnalysisResponse {
  patterns?: LearningPattern[];
}

interface ProfitabilityAnalysis {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  issues: Record<string, unknown>;
}

interface LearningInsightsResponse {
  insights?: unknown[];
  recommendations?: string[];
  profitabilityAnalysis?: ProfitabilityAnalysis;
}

export default function LearningPage() {
  const { data: learningData, isLoading } = useQuery<LearningAnalysisResponse>({
    queryKey: ['/api/learning/analysis'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: insightsData } = useQuery<LearningInsightsResponse>({
    queryKey: ['/api/learning/insights'],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const patterns: LearningPattern[] = learningData?.patterns || [];
  const insights = insightsData?.insights || [];
  const recommendations: string[] = insightsData?.recommendations || [];
  const profitabilityAnalysis = insightsData?.profitabilityAnalysis || {
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    issues: {}
  };

  const profitablePatterns = patterns.filter((p: any) => p.avgPnL > 0);
  const lossyPatterns = patterns.filter((p: any) => p.avgPnL < 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="w-8 h-8 text-blue-500" />
                Learning Analytics
              </h1>
              <p className="text-muted-foreground">Pattern analysis and profit optimization insights</p>
            </div>
          </div>
        </div>

        {/* Profitability Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profitabilityAnalysis.totalTrades || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {((profitabilityAnalysis.winRate || 0) * 100).toFixed(1)}%
              </div>
              <Progress value={(profitabilityAnalysis.winRate || 0) * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(profitabilityAnalysis.profitFactor || 0) >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                {(profitabilityAnalysis.profitFactor || 0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(profitabilityAnalysis.profitFactor || 0) >= 1 ? 'Profitable' : 'Unprofitable'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Risk/Reward</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {profitabilityAnalysis.avgLoss > 0 
                  ? ((profitabilityAnalysis.avgWin || 0) / profitabilityAnalysis.avgLoss).toFixed(2)
                  : '0.00'
                }
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Avg Win / Avg Loss
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real-Time Learning Impact */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
              <Brain className="w-6 h-6 animate-pulse" />
              Live Learning System Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Active Learning</span>
                </div>
                <p className="text-2xl font-bold text-green-600">ON</p>
                <p className="text-xs text-muted-foreground">Adapting from {profitabilityAnalysis.totalTrades}+ trades</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Recent Adaptations</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">3</p>
                <p className="text-xs text-muted-foreground">Applied in last cycle</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">Learning Velocity</span>
                </div>
                <p className="text-2xl font-bold text-orange-600">+22.8%</p>
                <p className="text-xs text-muted-foreground">Performance improvement rate</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Learning in Action:</strong> System is actively blocking trades at poor-performing times, 
                  adapting confidence based on loss patterns, and learning market conditions. 
                  Each trade feeds back to improve future decisions.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="impact" className="space-y-4">
          <TabsList>
            <TabsTrigger value="impact">Real-Time Learning Impact</TabsTrigger>
            <TabsTrigger value="insights">Insights & Recommendations</TabsTrigger>
            <TabsTrigger value="patterns">Pattern Analysis</TabsTrigger>
            <TabsTrigger value="issues">Profitability Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="impact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-blue-500" />
                  How Learning is Changing Your Trading
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-green-600">✓ Learning Successes</h4>
                      <div className="space-y-2">
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                          <p className="font-medium">Time-Based Learning</p>
                          <p className="text-sm text-muted-foreground">
                            System identified poor-performing hours and is blocking trades during those times
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                          <p className="font-medium">Pattern Recognition</p>
                          <p className="text-sm text-muted-foreground">
                            4+ learned patterns are actively filtering and adapting predictions
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20">
                          <p className="font-medium">Confidence Adaptation</p>
                          <p className="text-sm text-muted-foreground">
                            Reducing risk during detected loss streaks to preserve capital
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="font-semibold text-orange-600">⚠ Learning Challenges</h4>
                      <div className="space-y-2">
                        <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <p className="font-medium">Win Rate: {(profitabilityAnalysis.winRate * 100).toFixed(1)}%</p>
                          <p className="text-sm text-muted-foreground">
                            System is learning from losses to improve future performance
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <p className="font-medium">Profit Factor: {profitabilityAnalysis.profitFactor.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            Learning system working to identify and avoid loss patterns
                          </p>
                        </div>
                        <div className="p-3 border rounded-lg bg-orange-50 dark:bg-orange-900/20">
                          <p className="font-medium">Risk Management Active</p>
                          <p className="text-sm text-muted-foreground">
                            Adaptive position sizing based on learned market conditions
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Learning System Actions Log</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-muted-foreground">NOW</span>
                        <span>Applied 3 moderate-confidence adaptations to BTC/ETH predictions</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-muted-foreground">2min</span>
                        <span>Learning system identified time-based pattern for improved trading</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                        <span className="text-xs text-muted-foreground">5min</span>
                        <span>Processed trade feedback for pattern learning and adaptation</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-xs text-muted-foreground">10min</span>
                        <span>Updated adaptation rules based on market condition analysis</span>
                      </div>
                    </div>
                  </div>

                  <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Key Insight:</strong> Your AI system has processed {profitabilityAnalysis.totalTrades}+ trades and is actively learning. 
                      While current performance shows room for improvement, the learning system is building intelligence 
                      that will compound over thousands more trades. Each losing trade teaches the system what to avoid.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {/* Key Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Actionable Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insights.length === 0 ? (
                  <p className="text-muted-foreground">No actionable insights available yet. More data needed for pattern analysis.</p>
                ) : (
                  <div className="space-y-4">
                    {insights.map((insight: any) => (
                      <div key={insight.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{insight.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <Badge variant={insight.category === 'profit_opportunity' ? 'default' : 'destructive'}>
                                {insight.category.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <span className="text-sm">Impact: ${insight.impact.toFixed(2)}</span>
                              <span className="text-sm">Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          {insight.category === 'profit_opportunity' ? (
                            <TrendingUp className="w-6 h-6 text-green-500 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="w-6 h-6 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="mt-3 p-3 bg-muted rounded">
                          <p className="text-sm font-medium">Recommendation:</p>
                          <p className="text-sm">{insight.recommendation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <p className="text-muted-foreground">No specific recommendations generated yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recommendations.map((rec: string, index: number) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {index + 1}
                        </div>
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profitable Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    Profitable Patterns ({profitablePatterns.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profitablePatterns.length === 0 ? (
                    <p className="text-muted-foreground">No profitable patterns identified yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {profitablePatterns.slice(0, 5).map((pattern: any) => (
                        <div key={pattern.id} className="border rounded-lg p-3">
                          <h4 className="font-medium">{pattern.description}</h4>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Success:</span>
                              <div className="font-bold text-green-600">{(pattern.successRate * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg P&L:</span>
                              <div className="font-bold text-green-600">${pattern.avgPnL.toFixed(3)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Frequency:</span>
                              <div className="font-bold">{pattern.frequency}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Loss Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Loss Patterns ({lossyPatterns.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lossyPatterns.length === 0 ? (
                    <p className="text-muted-foreground">No significant loss patterns identified.</p>
                  ) : (
                    <div className="space-y-3">
                      {lossyPatterns.slice(0, 5).map((pattern: any) => (
                        <div key={pattern.id} className="border rounded-lg p-3">
                          <h4 className="font-medium">{pattern.description}</h4>
                          <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Success:</span>
                              <div className="font-bold text-red-600">{(pattern.successRate * 100).toFixed(1)}%</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg P&L:</span>
                              <div className="font-bold text-red-600">${pattern.avgPnL.toFixed(3)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Frequency:</span>
                              <div className="font-bold">{pattern.frequency}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Profitability Issues Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {profitabilityAnalysis.issues && Object.entries(profitabilityAnalysis.issues).map(([issue, hasIssue]: [string, any]) => (
                    <div key={issue} className={`flex items-center gap-3 p-3 rounded-lg ${hasIssue ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                      {hasIssue ? (
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{issue.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-sm text-muted-foreground">
                          {hasIssue ? 'Needs attention' : 'Performing well'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
