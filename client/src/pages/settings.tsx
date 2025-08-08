
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { Link } from "wouter";

export default function SettingsPage() {
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
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground">Configure your trading preferences</p>
            </div>
          </div>
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Management */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="maxDrawdown">Max Drawdown (%)</Label>
                <Input id="maxDrawdown" type="number" defaultValue="10" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="positionSize">Max Position Size (%)</Label>
                <Input id="positionSize" type="number" defaultValue="25" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyLoss">Daily Loss Limit ($)</Label>
                <Input id="dailyLoss" type="number" defaultValue="1000" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="riskHalt" />
                <Label htmlFor="riskHalt">Auto halt on risk breach</Label>
              </div>
            </CardContent>
          </Card>

          {/* Trading Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Trading Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slippage">Max Slippage (%)</Label>
                <Input id="slippage" type="number" defaultValue="0.1" step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderTimeout">Order Timeout (seconds)</Label>
                <Input id="orderTimeout" type="number" defaultValue="30" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="autoTrade" defaultChecked />
                <Label htmlFor="autoTrade">Enable auto trading</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="paperTrading" />
                <Label htmlFor="paperTrading">Paper trading mode</Label>
              </div>
            </CardContent>
          </Card>

          {/* API Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">Binance API Key</Label>
                <Input id="apiKey" type="password" placeholder="Enter API key" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input id="apiSecret" type="password" placeholder="Enter API secret" />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="testnet" defaultChecked />
                <Label htmlFor="testnet">Use testnet</Label>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch id="tradeNotifs" defaultChecked />
                <Label htmlFor="tradeNotifs">Trade notifications</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="alertNotifs" defaultChecked />
                <Label htmlFor="alertNotifs">System alerts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="emailNotifs" />
                <Label htmlFor="emailNotifs">Email notifications</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="your@email.com" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
