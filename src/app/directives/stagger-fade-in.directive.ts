import { Directive, ElementRef, AfterViewInit, Input } from '@angular/core';
import gsap from 'gsap';

@Directive({
    selector: '[appStaggerFadeIn]',
    standalone: true
})
export class StaggerFadeInDirective implements AfterViewInit {
    @Input() staggerDelay: number = 0.05; // Delay between each item
    @Input() childSelector: string = '.mat-mdc-row'; // Selector for children to animate

    constructor(private el: ElementRef) { }

    ngAfterViewInit(): void {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
            const children = this.el.nativeElement.querySelectorAll(this.childSelector);

            if (children.length > 0) {
                // Set initial state
                gsap.set(children, {
                    opacity: 0,
                    y: 20
                });

                // Animate with stagger
                gsap.to(children, {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    ease: 'power2.out',
                    stagger: this.staggerDelay
                });
            }
        }, 100);
    }
}
