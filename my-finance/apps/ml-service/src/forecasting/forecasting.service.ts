import { Injectable, Logger } from '@nestjs/common';
import { ForecastExpenseDto, ForecastResponseDto, MonthForecast } from './dto/forecast.dto';

/**
 * Time Series Forecasting Service
 * Phase 1: Simple moving average + trend analysis
 * Phase 2: ARIMA, Prophet models
 */
@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  /**
   * Forecast future expenses using moving average and trend analysis
   */
  async forecastExpenses(dto: ForecastExpenseDto): Promise<ForecastResponseDto> {
    this.logger.log(`Forecasting ${dto.monthsAhead} months ahead for user ${dto.userId}`);

    // TODO: Fetch historical data from Report Service
    // For now, use mock data for demonstration
    const historical = this.getMockHistoricalData(dto.userId);

    if (historical.expenses.length < 3) {
      throw new Error('Insufficient historical data for forecasting (minimum 3 months required)');
    }

    // Calculate forecasts
    const forecasts = this.generateForecasts(
      historical.expenses,
      historical.months,
      dto.monthsAhead,
    );

    // Generate insights
    const insights = this.generateInsights(historical.expenses, forecasts);

    return {
      userId: dto.userId,
      forecasts,
      historical,
      metadata: {
        model: 'moving-average-trend-v1',
        accuracy: this.estimateAccuracy(historical.expenses),
        dataPoints: historical.expenses.length,
      },
      insights,
    };
  }

  /**
   * Generate forecasts using exponential moving average + linear trend
   */
  private generateForecasts(
    historicalExpenses: number[],
    historicalMonths: string[],
    monthsAhead: number,
  ): MonthForecast[] {
    const forecasts: MonthForecast[] = [];

    // Calculate trend (linear regression slope)
    const trend = this.calculateTrend(historicalExpenses);

    // Calculate exponential moving average (EMA) for smoothing
    const alpha = 0.3; // Smoothing factor
    let ema = historicalExpenses[0];
    for (let i = 1; i < historicalExpenses.length; i++) {
      ema = alpha * historicalExpenses[i] + (1 - alpha) * ema;
    }

    // Calculate standard deviation for confidence intervals
    const stdDev = this.calculateStdDev(historicalExpenses);

    // Generate forecasts
    const lastMonth = historicalMonths[historicalMonths.length - 1];
    let currentMonth = this.getNextMonth(lastMonth);

    for (let i = 1; i <= monthsAhead; i++) {
      // Predicted value = EMA + trend * i
      const predicted = ema + trend * i;

      // Confidence interval (95% = ±1.96 * stdDev)
      const margin = 1.96 * stdDev * Math.sqrt(i); // Uncertainty increases with time
      const lowerBound = Math.max(0, predicted - margin);
      const upperBound = predicted + margin;

      // Determine trend direction
      let trendDirection: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(trend) < stdDev * 0.1) {
        trendDirection = 'stable';
      } else if (trend > 0) {
        trendDirection = 'increasing';
      } else {
        trendDirection = 'decreasing';
      }

      forecasts.push({
        month: currentMonth,
        predicted: Math.round(predicted),
        lowerBound: Math.round(lowerBound),
        upperBound: Math.round(upperBound),
        trend: trendDirection,
        breakdown: this.estimateBreakdown(predicted),
      });

      currentMonth = this.getNextMonth(currentMonth);
    }

    return forecasts;
  }

  /**
   * Calculate linear trend (slope of regression line)
   */
  private calculateTrend(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return slope;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Estimate category breakdown (proportional to historical average)
   */
  private estimateBreakdown(totalPredicted: number): Record<string, number> {
    // TODO: Use actual historical category proportions
    // For now, use typical proportions
    const proportions = {
      food: 0.35,
      transport: 0.20,
      entertainment: 0.15,
      shopping: 0.15,
      bills: 0.10,
      other: 0.05,
    };

    const breakdown: Record<string, number> = {};
    for (const [category, proportion] of Object.entries(proportions)) {
      breakdown[category] = Math.round(totalPredicted * proportion);
    }

    return breakdown;
  }

  /**
   * Estimate forecast accuracy based on historical volatility
   */
  private estimateAccuracy(expenses: number[]): number {
    if (expenses.length < 2) return 0.5;

    const stdDev = this.calculateStdDev(expenses);
    const mean = expenses.reduce((a, b) => a + b, 0) / expenses.length;

    // Coefficient of variation
    const cv = stdDev / mean;

    // Lower CV = higher accuracy
    // CV < 0.1 → 95% accuracy
    // CV > 0.5 → 50% accuracy
    const accuracy = Math.max(0.5, Math.min(0.95, 1 - cv));

    return parseFloat(accuracy.toFixed(2));
  }

  /**
   * Generate insights from forecasts
   */
  private generateInsights(
    historical: number[],
    forecasts: MonthForecast[],
  ): string[] {
    const insights: string[] = [];

    // Trend insight
    const trend = this.calculateTrend(historical);
    const avgExpense = historical.reduce((a, b) => a + b, 0) / historical.length;
    const trendPercent = ((trend / avgExpense) * 100).toFixed(1);

    if (Math.abs(trend) > avgExpense * 0.02) {
      if (trend > 0) {
        insights.push(`📈 Chi tiêu tăng trung bình ${trendPercent}% mỗi tháng`);
      } else {
        insights.push(`📉 Chi tiêu giảm trung bình ${Math.abs(parseFloat(trendPercent))}% mỗi tháng`);
      }
    } else {
      insights.push(`📊 Chi tiêu tương đối ổn định`);
    }

    // Highest forecast month
    const maxForecast = forecasts.reduce((max, f) =>
      f.predicted > max.predicted ? f : max,
    );
    if (maxForecast.predicted > avgExpense * 1.1) {
      insights.push(`⚠️ Dự kiến chi tiêu cao nhất vào ${maxForecast.month} (${maxForecast.predicted.toLocaleString('vi-VN')} VND)`);
    }

    // Budget recommendation
    const nextMonthPredicted = forecasts[0].predicted;
    if (nextMonthPredicted > avgExpense * 1.2) {
      const savings = Math.round((nextMonthPredicted - avgExpense) * 0.7);
      insights.push(`💡 Gợi ý tiết kiệm ${savings.toLocaleString('vi-VN')} VND tháng tới để duy trì mức chi bình thường`);
    }

    // Volatility warning
    const stdDev = this.calculateStdDev(historical);
    const cv = stdDev / avgExpense;
    if (cv > 0.3) {
      insights.push(`📊 Chi tiêu dao động khá lớn - nên lập kế hoạch budget rõ ràng hơn`);
    }

    return insights;
  }

  /**
   * Get next month in MM/YYYY format
   */
  private getNextMonth(currentMonth: string): string {
    const [month, year] = currentMonth.split('/').map(Number);

    let nextMonth = month + 1;
    let nextYear = year;

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }

    return `${nextMonth.toString().padStart(2, '0')}/${nextYear}`;
  }

  /**
   * Mock historical data (TODO: Replace with actual Report Service call)
   */
  private getMockHistoricalData(userId: string): {
    months: string[];
    expenses: number[];
  } {
    // Simulate 12 months of data with realistic trend
    const baseExpense = 5000000; // 5M VND base
    const months: string[] = [];
    const expenses: number[] = [];

    const now = new Date();
    let month = now.getMonth() + 1; // 1-12
    let year = now.getFullYear();

    // Go back 12 months
    for (let i = 11; i >= 0; i--) {
      const m = month - i;
      let adjustedMonth = m;
      let adjustedYear = year;

      if (adjustedMonth <= 0) {
        adjustedMonth += 12;
        adjustedYear -= 1;
      }

      months.push(`${adjustedMonth.toString().padStart(2, '0')}/${adjustedYear}`);

      // Add trend + seasonality + noise
      const trend = i * 50000; // Increasing trend
      const seasonality = Math.sin((adjustedMonth / 12) * 2 * Math.PI) * 500000; // Seasonal pattern
      const noise = (Math.random() - 0.5) * 400000; // Random variation

      expenses.push(Math.round(baseExpense + trend + seasonality + noise));
    }

    this.logger.debug(`Generated mock data: ${months.length} months`);

    return { months, expenses };
  }
}
