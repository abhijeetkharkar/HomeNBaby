import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'numberWithSuffix',
  standalone: true
})
export class NumberWithSuffixPipe implements PipeTransform {
  transform(input: number | string, fractionDigits?: number): string {
    const suffixes = ['K', 'M', 'B', 'T', 'Z'];

    const num = typeof input === 'string' ? parseFloat(input) : input;
    
    if (Number.isNaN(num)) {
      return '';
    }

    if (num < 1000) {
      return num.toString();
    }

    const exp = Math.floor(Math.log(num) / Math.log(1000));

    return (num / Math.pow(1000, exp)).toFixed(fractionDigits || 1) + suffixes[exp - 1];
  }
}
