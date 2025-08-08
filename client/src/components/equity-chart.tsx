import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function EquityChart() {
  const [selectedPeriod, setSelectedPeriod] = useState("1W");
  const periods = ["1D", "1W", "1M", "3M"];

  return (
    <Card className="bg-dark-secondary border-dark-tertiary mb-6">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="font-semibold">Portfolio Equity Curve</CardTitle>
          <div className="flex space-x-2">
            {periods.map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className={selectedPeriod === period 
                  ? "bg-info text-white" 
                  : "bg-dark-tertiary border-dark-tertiary text-text-secondary hover:text-text-primary"
                }
              >
                {period}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Simulated chart area */}
        <div className="h-80 bg-dark-bg rounded flex items-center justify-center relative overflow-hidden">
          {/* SVG chart simulation */}
          <svg className="w-full h-full absolute" viewBox="0 0 800 300">
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 30" fill="none" stroke="var(--dark-tertiary)" strokeWidth="0.5" opacity="0.3"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)"/>
            
            {/* Equity curve */}
            <polyline 
              points="50,250 100,240 150,220 200,200 250,180 300,160 350,140 400,130 450,120 500,110 550,100 600,90 650,85 700,80 750,75" 
              fill="none" 
              stroke="var(--success)" 
              strokeWidth="2"
            />
            
            {/* Strategy breakdown */}
            <polyline 
              points="50,250 100,245 150,235 200,225 250,210 300,195 350,185 400,175 450,170 500,165 550,160 600,155 650,152 700,150 750,148" 
              fill="none" 
              stroke="var(--info)" 
              strokeWidth="1.5" 
              opacity="0.7"
            />
            <polyline 
              points="50,250 100,248 150,242 200,238 250,230 300,220 350,210 400,200 450,190 500,180 550,170 600,160 650,155 700,152 750,150" 
              fill="none" 
              stroke="var(--warning)" 
              strokeWidth="1.5" 
              opacity="0.7"
            />
          </svg>
          
          {/* Chart legend */}
          <div className="absolute top-4 left-4 space-y-1">
            <div className="flex items-center space-x-2 text-xs">
              <div className="w-3 h-0.5 bg-success"></div>
              <span className="text-text-secondary">Total Portfolio</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <div className="w-3 h-0.5 bg-info"></div>
              <span className="text-text-secondary">Trend MA</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <div className="w-3 h-0.5 bg-warning"></div>
              <span className="text-text-secondary">Breakout</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
