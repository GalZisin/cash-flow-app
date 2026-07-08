import { Directive, ElementRef, Input, OnInit, OnDestroy } from '@angular/core';
import gsap from 'gsap';

/**
 * Directive for creating elegant skeleton loading animations
 * Usage:
 * <div appSkeletonLoader [isLoading]="isLoading" [rows]="5">
 *   <!-- Your content here -->
 * </div>
 */
@Directive({
    selector: '[appSkeletonLoader]',
    standalone: true
})
export class SkeletonLoaderDirective implements OnInit, OnDestroy {
    @Input() isLoading: boolean = true;
    @Input() rows: number = 3;
    @Input() fadeInDuration: number = 0.4;

    private skeletonContainer: HTMLElement | null = null;
    private originalDisplay: string = '';

    constructor(private el: ElementRef) { }

    ngOnInit(): void {
        this.originalDisplay = this.el.nativeElement.style.display;

        if (this.isLoading) {
            this.showSkeleton();
        }
    }

    ngOnChanges(): void {
        if (this.isLoading) {
            this.showSkeleton();
        } else {
            this.hideSkeleton();
        }
    }

    private showSkeleton(): void {
        // Hide original content
        this.el.nativeElement.style.display = 'none';

        // Create skeleton if it doesn't exist
        if (!this.skeletonContainer) {
            this.createSkeleton();
        }
    }

    private hideSkeleton(): void {
        if (this.skeletonContainer) {
            // Fade out skeleton
            gsap.to(this.skeletonContainer, {
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    this.skeletonContainer?.remove();
                    this.skeletonContainer = null;

                    // Show real content with fade in
                    this.el.nativeElement.style.display = this.originalDisplay;
                    gsap.from(this.el.nativeElement, {
                        opacity: 0,
                        y: 10,
                        duration: this.fadeInDuration,
                        ease: 'power2.out'
                    });
                }
            });
        } else {
            this.el.nativeElement.style.display = this.originalDisplay;
        }
    }

    private createSkeleton(): void {
        this.skeletonContainer = document.createElement('div');
        this.skeletonContainer.className = 'skeleton-loader-container';

        // Insert skeleton after the original element
        this.el.nativeElement.parentNode?.insertBefore(
            this.skeletonContainer,
            this.el.nativeElement
        );

        // Animate skeleton in
        gsap.from(this.skeletonContainer, {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.out'
        });
    }

    ngOnDestroy(): void {
        if (this.skeletonContainer) {
            this.skeletonContainer.remove();
        }
    }
}
