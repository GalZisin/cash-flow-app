import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import gsap from 'gsap';

@Directive({
    selector: '[appAnimateProgress]',
    standalone: true
})
export class AnimateProgressDirective implements OnChanges {
    @Input() appAnimateProgress: number = 0; // Value from 0 to 100
    @Input() duration: number = 1;

    constructor(private el: ElementRef) {
        // Set initial width to 0
        this.el.nativeElement.style.width = '0%';
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['appAnimateProgress']) {
            const newValue = Math.min(100, Math.max(0, changes['appAnimateProgress'].currentValue || 0));
            this.animateToValue(newValue);
        }
    }

    private animateToValue(targetValue: number): void {
        gsap.to(this.el.nativeElement, {
            width: `${targetValue}%`,
            duration: this.duration,
            ease: 'power2.out'
        });
    }
}
