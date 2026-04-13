import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calculator, Download, TrendingDown, TrendingUp, PieChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EMICalculation {
  loanAmount: number;
  interestRate: number;
  tenureMonths: number;
  emi: number;
  totalInterest: number;
  totalPayment: number;
  processingFee: number;
  amortizationSchedule: Array<{
    month: number;
    principal: number;
    interest: number;
    balance: number;
    totalPayment: number;
  }>;
}

interface EMICalculatorProps {
  defaultAmount?: number;
  defaultRate?: number;
  defaultTenure?: number;
  showDownload?: boolean;
}

export default function EMICalculator({
  defaultAmount = 500000,
  defaultRate = 10.5,
  defaultTenure = 60,
  showDownload = true,
}: EMICalculatorProps) {
  const [loanAmount, setLoanAmount] = useState([defaultAmount]);
  const [interestRate, setInterestRate] = useState([defaultRate]);
  const [tenureMonths, setTenureMonths] = useState([defaultTenure]);
  const [processingFee, setProcessingFee] = useState([2]);
  const [calculation, setCalculation] = useState<EMICalculation | null>(null);

  const calculateEMI = useMutation({
    mutationFn: async (data: { loanAmount: number; interestRate: number; tenureMonths: number; processingFeePercent: number }) => {
      const res = await fetch("/api/loans/calculate-emi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to calculate EMI");
      return res.json();
    },
    onSuccess: (data) => {
      setCalculation(data);
    },
  });

  useEffect(() => {
    calculateEMI.mutate({
      loanAmount: loanAmount[0],
      interestRate: interestRate[0],
      tenureMonths: tenureMonths[0],
      processingFeePercent: processingFee[0],
    });
  }, [loanAmount, interestRate, tenureMonths, processingFee]);

  const formatAmount = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatTenure = (months: number) => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0 && remainingMonths > 0) return `${years}Y ${remainingMonths}M`;
    if (years > 0) return `${years} Years`;
    return `${months} Months`;
  };

  const downloadSchedule = () => {
    if (!calculation) return;

    const csvContent = [
      ['Month', 'Principal', 'Interest', 'EMI', 'Balance'],
      ...calculation.amortizationSchedule.map(row => [
        row.month,
        row.principal,
        row.interest,
        row.totalPayment,
        row.balance,
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loan-amortization-schedule.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const principalPercent = calculation 
    ? (calculation.loanAmount / calculation.totalPayment) * 100 
    : 0;
  const interestPercent = calculation 
    ? (calculation.totalInterest / calculation.totalPayment) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            EMI Calculator
          </CardTitle>
          <CardDescription>
            Calculate your monthly EMI and view amortization schedule
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Sliders */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Loan Amount</Label>
                <span className="text-sm font-medium">{formatAmount(loanAmount[0])}</span>
              </div>
              <Slider
                value={loanAmount}
                onValueChange={setLoanAmount}
                min={50000}
                max={10000000}
                step={50000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>₹50K</span>
                <span>₹1Cr</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Interest Rate (p.a.)</Label>
                <span className="text-sm font-medium">{interestRate[0].toFixed(2)}%</span>
              </div>
              <Slider
                value={interestRate}
                onValueChange={setInterestRate}
                min={6}
                max={24}
                step={0.1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>6%</span>
                <span>24%</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Loan Tenure</Label>
                <span className="text-sm font-medium">{formatTenure(tenureMonths[0])}</span>
              </div>
              <Slider
                value={tenureMonths}
                onValueChange={setTenureMonths}
                min={6}
                max={360}
                step={6}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>6 Months</span>
                <span>30 Years</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Processing Fee (%)</Label>
                <span className="text-sm font-medium">{processingFee[0].toFixed(2)}%</span>
              </div>
              <Slider
                value={processingFee}
                onValueChange={setProcessingFee}
                min={0}
                max={5}
                step={0.1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>5%</span>
              </div>
            </div>
          </div>

          {/* Results */}
          {calculation && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-gradient-to-br from-rai-50 to-rai-100 border-rai-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-muted-foreground">Monthly EMI</p>
                      <TrendingDown className="h-4 w-4 text-rai-500" />
                    </div>
                    <p className="text-3xl font-bold text-rai-600">{formatAmount(calculation.emi)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tenureMonths[0]} monthly payments
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-muted-foreground">Total Interest</p>
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-3xl font-bold text-amber-600">{formatAmount(calculation.totalInterest)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((calculation.totalInterest / calculation.loanAmount) * 100).toFixed(1)}% of principal
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/10 to-accent/40 border-primary/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm text-muted-foreground">Total Payment</p>
                      <Calculator className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-3xl font-bold text-primary">{formatAmount(calculation.totalPayment)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Principal + Interest + Fees
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Principal vs Interest Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Principal Amount</span>
                        <span className="text-sm font-medium">{formatAmount(calculation.loanAmount)} ({principalPercent.toFixed(1)}%)</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-rai-500 transition-all"
                          style={{ width: `${principalPercent}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Total Interest</span>
                        <span className="text-sm font-medium">{formatAmount(calculation.totalInterest)} ({interestPercent.toFixed(1)}%)</span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500 transition-all"
                          style={{ width: `${interestPercent}%` }}
                        />
                      </div>
                    </div>

                    {calculation.processingFee > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Processing Fee (one-time)</span>
                          <span className="text-sm font-medium">{formatAmount(calculation.processingFee)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Excel Formulas Note */}
              <Card className="bg-rai-50 border-rai-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-rai-800">
                    <strong>Note:</strong> All calculations use standard Excel formulas (PMT, IPMT, PPMT) for accuracy.
                    EMI = P × r × (1+r)^n / ((1+r)^n - 1), where P = Principal, r = Monthly Rate, n = Tenure
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </CardContent>
      </Card>

      {/* Amortization Schedule */}
      {calculation && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Amortization Schedule</CardTitle>
                <CardDescription>Month-wise breakdown of principal and interest</CardDescription>
              </div>
              {showDownload && (
                <Button variant="outline" size="sm" onClick={downloadSchedule}>
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="yearly" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>

              <TabsContent value="yearly">
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Total Payment</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: Math.ceil(calculation.amortizationSchedule.length / 12) }, (_, i) => {
                        const yearData = calculation.amortizationSchedule.slice(i * 12, (i + 1) * 12);
                        const yearPrincipal = yearData.reduce((sum, row) => sum + row.principal, 0);
                        const yearInterest = yearData.reduce((sum, row) => sum + row.interest, 0);
                        const yearPayment = yearData.reduce((sum, row) => sum + row.totalPayment, 0);
                        const yearEndBalance = yearData[yearData.length - 1]?.balance || 0;

                        return (
                          <TableRow key={i}>
                            <TableCell>Year {i + 1}</TableCell>
                            <TableCell className="text-right">{formatAmount(Math.round(yearPrincipal))}</TableCell>
                            <TableCell className="text-right">{formatAmount(Math.round(yearInterest))}</TableCell>
                            <TableCell className="text-right font-medium">{formatAmount(Math.round(yearPayment))}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatAmount(Math.round(yearEndBalance))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="monthly">
                <div className="max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">EMI</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculation.amortizationSchedule.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell>{row.month}</TableCell>
                          <TableCell className="text-right">{formatAmount(row.principal)}</TableCell>
                          <TableCell className="text-right">{formatAmount(row.interest)}</TableCell>
                          <TableCell className="text-right font-medium">{formatAmount(row.totalPayment)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(row.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
