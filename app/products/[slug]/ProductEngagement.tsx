'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';

type Review = {
  id?: string;
  name: string;
  rating: number;
  text: string;
  verifiedPurchase?: boolean;
  createdAt?: string;
};

export default function ProductEngagement({ product }: { product: { slug: string; title: string; price: string; category: string } }) {
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const wishlist = JSON.parse(localStorage.getItem('diginanba-wishlist') || '[]');
      setSaved(Array.isArray(wishlist) && wishlist.some((item: { slug?: string }) => item.slug === product.slug));
    } catch {
      setSaved(false);
    }

    let active = true;
    setLoadingReviews(true);
    fetch('/api/products/' + encodeURIComponent(product.slug) + '/reviews')
      .then(async (response) => {
        if (!response.ok) throw new Error('Reviews are temporarily unavailable.');
        return response.json();
      })
      .then((data) => { if (active) setReviews(Array.isArray(data.reviews) ? data.reviews : []); })
      .catch(() => { if (active) setReviewMessage('Reviews are temporarily unavailable. Please try again later.'); })
      .finally(() => { if (active) setLoadingReviews(false); });
    return () => { active = false; };
  }, [product.slug]);

  async function toggleWishlist() {
    const nextSaved = !saved;
    try {
      const current = JSON.parse(localStorage.getItem('diginanba-wishlist') || '[]');
      const wishlist = Array.isArray(current) ? current : [];
      const next = nextSaved
        ? [...wishlist.filter((item: { slug?: string }) => item.slug !== product.slug), product]
        : wishlist.filter((item: { slug?: string }) => item.slug !== product.slug);
      localStorage.setItem('diginanba-wishlist', JSON.stringify(next));
      setSaved(nextSaved);
      setReviewMessage('');

      // Guests retain a browser-local wishlist; signed-in customers also sync to PostgreSQL.
      const response = await fetch('/api/wishlist', {
        method: nextSaved ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.slug }),
      });
      if (response.status === 503) {
        setReviewMessage('Saved on this device. Account sync is temporarily unavailable.');
      }
    } catch {
      setReviewMessage('Saved on this device, but account sync could not be reached.');
    }
  }

  async function publishReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setReviewMessage('');
    try {
      const response = await fetch('/api/products/' + encodeURIComponent(product.slug) + '/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReviewMessage(response.status === 401
          ? 'Please sign in before reviewing a purchase.'
          : data.error || 'Unable to publish your review.');
        return;
      }
      setReviews((current) => [data.review, ...current.filter((review) => review.id !== data.review.id)]);
      setText('');
      setReviewMessage('Your verified-purchase review has been published.');
    } catch {
      setReviewMessage('Connection problem. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const average = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : 'New';

  return (
    <>
      <div className="product-actions">
        <button className="btn" onClick={toggleWishlist}>{saved ? '♥ Saved to wishlist' : '♡ Save to wishlist'}</button>
        <Link className="btn" href={'/explore?q=' + encodeURIComponent(product.category)}>More in {product.category}</Link>
      </div>
      <section className="panel product-detail-grid">
        <div>
          <h2>What you get</h2>
          <ul className="feature-list">
            <li>Practical ready-to-use digital resource</li>
            <li>Market-localized edition</li>
            <li>Review the product-specific usage terms before use</li>
            <li>Digital delivery after successful payment and fulfillment</li>
          </ul>
          <p className="muted">Please review the product description and applicable usage terms before purchasing.</p>
        </div>
        <div>
          <h2>Ratings &amp; verified reviews</h2>
          <div className="review-summary"><b>{average}</b><span>{reviews.length} verified review{reviews.length === 1 ? '' : 's'}</span></div>
          {loadingReviews && <p className="muted">Loading reviews…</p>}
          {!loadingReviews && reviews.length === 0 && <p className="muted">No verified reviews yet. Customers can review after a completed purchase.</p>}
          {reviews.slice(0, 5).map((review, index) => (
            <div className="review" key={review.id || index}>
              <b>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</b>
              <p>{review.text}</p>
              <small>{review.name} · Verified purchase</small>
            </div>
          ))}
          <form className="review-form" onSubmit={publishReview}>
            <label htmlFor="review-rating">Your rating</label>
            <select id="review-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
            </select>
            <label htmlFor="review-text">Your review</label>
            <textarea id="review-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} placeholder="Share what you found useful…" required />
            <button className="btn primary" type="submit" disabled={submitting}>{submitting ? 'Publishing…' : 'Publish verified review'}</button>
          </form>
          {reviewMessage && <p className="muted" role="status">{reviewMessage} {reviewMessage.includes('sign in') && <Link href="/login">Sign in</Link>}</p>}
        </div>
      </section>
    </>
  );
}
