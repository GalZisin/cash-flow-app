import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import gsap from 'gsap';

@Directive({
    selector: '[appAnimateNumber]',
    standalone: true
})
export class AnimateNumberDirective implements OnChanges {
    @Input() appAnimateNumber: number = 0;
    @Input() duration: number = 0.8;
    @Input() decimals: number = 0;

    private currentValue = 0;

    constructor(private el: ElementRef) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['appAnimateNumber']) {
            const newValue = changes['appAnimateNumber'].currentValue || 0;
            this.animateToValue(newValue);
        }
    }

    private animateToValue(targetValue: number): void {
        const obj = { val: this.currentValue };

        gsap.to(obj, {
            val: targetValue,
            duration: this.duration,
            ease: 'power2.out',
            onUpdate: () => {
                const formatted = obj.val.toLocaleString('he-IL', {
                    minimumFractionDigits: this.decimals,
                    maximumFractionDigits: this.decimals
                });
                this.el.nativeElement.textContent = formatted;
            },
            onComplete: () => {
                this.currentValue = targetValue;
            }
        });
    }
}
