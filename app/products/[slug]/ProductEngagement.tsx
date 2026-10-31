'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Review = { id?: string; rating: number; createdAt?: string };

export default function ProductEngagement({ product }: { product: { slug: string; title: string; price: string; category: string } }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [canRate, setCanRate] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewMessage, setReviewMessage] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    fetch('/api/products/' + encodeURIComponent(product.slug) + '/reviews')
      .then(async (response) => {
        if (!response.ok) throw new Error('Ratings are temporarily unavailable.');
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setCanRate(Boolean(data.canRate));
        if (data.userRating) setRating(Number(data.userRating));
      })
      .catch(() => { if (active) setReviewMessage('Ratings are temporarily unavailable.'); })
      .finally(() => { if (active) setLoadingReviews(false); });
    return () => { active = false; };
  }, [product.slug]);

  async function submitRating(value: number) {
    if (!canRate || submitting) return;
    setSubmitting(true);
    setReviewMessage('');
    try {
      const response = await fetch('/api/products/' + encodeURIComponent(product.slug) + '/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: value }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReviewMessage(data.error || 'Unable to save your rating.');
        return;
      }
      setRating(value);
      setReviews((current) => [data.review, ...current.filter((review) => review.id !== data.review.id)]);
      setReviewMessage('Your rating has been saved.');
    } catch {
      setReviewMessage('Connection problem. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <section className="panel product-rating-panel" aria-label="Product rating">
      <div className="product-rating-line">
        {average && <strong>{average}/5</strong>}
        <span className="product-rating-stars" aria-label={average ? average + ' out of 5 stars' : 'No ratings yet'}>{'★'.repeat(5)}</span>
        <span className="muted">{reviews.length ? reviews.length + (reviews.length === 1 ? ' rating' : ' ratings') : 'No ratings yet'}</span>
      </div>
      {loadingReviews ? <p className="muted">Loading…</p> : canRate ? (
        <div className="product-rate-control" aria-label="Rate this purchased product">
          <span className="muted">Your rating</span>
          <div className="product-rate-stars">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" className={value <= rating ? 'selected' : ''} onClick={() => submitRating(value)} disabled={submitting} aria-label={'Rate ' + value + ' out of 5 stars'}>★</button>
            ))}
          </div>
        </div>
      ) : null}
      {reviewMessage && <p className="muted" role="status">{reviewMessage} {reviewMessage.includes('sign in') && <Link href="/login">Sign in</Link>}</p>}
    </section>
  );
}
