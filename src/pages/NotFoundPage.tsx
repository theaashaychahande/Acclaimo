import { Link } from "react-router-dom";
import { PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight } from "../components/ui/Icons";

export function NotFoundPage() {
  return (
    <PageIntro
      eyebrow="404"
      title="This page isn't here."
      intro="The link may be wrong, or the page may have moved. Nothing is broken on your side."
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link to="/" className={buttonClasses({ size: "sm" })}>
          Back to home
          <ArrowRight className="size-4" />
        </Link>
        <Link to="/help" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Open help
        </Link>
      </div>
    </PageIntro>
  );
}
