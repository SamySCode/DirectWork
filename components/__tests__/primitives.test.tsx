import { fireEvent, render, screen } from "@testing-library/react-native";
import { Avatar, initials } from "../Avatar";
import { Badge } from "../Badge";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { EmptyState } from "../EmptyState";
import { ErrorState } from "../ErrorState";
import { Gallery } from "../Gallery";
import { ImagePickerGrid } from "../ImagePickerGrid";
import { HeroStat, PageHero } from "../PageHero";
import { TextField } from "../TextField";
import { tabThemes } from "../../lib/theme";

describe("Button", () => {
  it("calls onPress", () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole("button", { name: "Save" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is disabled and busy while loading, and ignores presses", () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} loading />);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("respects disabled", () => {
    render(<Button label="Go" onPress={jest.fn()} disabled />);
    expect(screen.getByRole("button", { name: "Go" })).toBeDisabled();
  });
});

describe("TextField", () => {
  it("labels the input for screen readers and marks required fields", () => {
    render(<TextField label="Title" required value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.getByLabelText("required")).toBeTruthy();
  });

  it("shows the error instead of the hint, and exposes it as the input's hint", () => {
    const { rerender } = render(
      <TextField label="Bio" hint="Keep it short" value="" onChangeText={jest.fn()} />,
    );
    expect(screen.getByText("Keep it short")).toBeTruthy();
    rerender(
      <TextField
        label="Bio"
        hint="Keep it short"
        error="Too long"
        value=""
        onChangeText={jest.fn()}
      />,
    );
    expect(screen.queryByText("Keep it short")).toBeNull();
    expect(screen.getByText("Too long")).toBeTruthy();
    expect(screen.getByLabelText("Bio").props.accessibilityHint).toBe("Too long");
  });

  it("counts characters against maxLength", () => {
    render(
      <TextField label="Note" value="hello" maxLength={10} showCount onChangeText={jest.fn()} />,
    );
    expect(screen.getByText("5 / 10")).toBeTruthy();
  });

  it("forwards typing and blur", () => {
    const onChangeText = jest.fn();
    const onBlur = jest.fn();
    render(<TextField label="Name" value="" onChangeText={onChangeText} onBlur={onBlur} />);
    fireEvent.changeText(screen.getByLabelText("Name"), "Sam");
    fireEvent(screen.getByLabelText("Name"), "blur");
    expect(onChangeText).toHaveBeenCalledWith("Sam");
    expect(onBlur).toHaveBeenCalled();
  });
});

describe("Chip", () => {
  it("reports selected state and toggles", () => {
    const onPress = jest.fn();
    render(<Chip label="Remote" selected onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Remote" });
    expect(chip).toBeSelected();
    fireEvent.press(chip);
    expect(onPress).toHaveBeenCalled();
  });

  it("uses the tab tint when selected", () => {
    render(<Chip label="All" selected tint="#123456" onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "All" })).toHaveStyle({ backgroundColor: "#123456" });
  });
});

describe("Avatar", () => {
  it.each([
    ["Sam Saib", "SS"],
    ["priya", "P"],
    ["  Ana  María  López ", "AL"],
    ["", "?"],
  ])("initials(%p) = %p", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  // Decorative: hidden from screen readers (the name is always shown beside it).
  const hidden = { includeHiddenElements: true };

  it("shows the photo over the initials when a uri is given", () => {
    render(<Avatar name="Sam Saib" uri="https://img/x.jpg" />);
    expect(screen.getByText("SS", hidden)).toBeTruthy();
    expect(screen.getByTestId("expo-image", hidden).props.source).toEqual({
      uri: "https://img/x.jpg",
    });
  });

  it("has no image without a uri, and is hidden from screen readers", () => {
    render(<Avatar name="Sam Saib" />);
    expect(screen.queryByTestId("expo-image", hidden)).toBeNull();
    expect(screen.queryByText("SS")).toBeNull();
  });
});

describe("Badge", () => {
  it("renders its label", () => {
    render(<Badge label="Live" tone="mint" />);
    expect(screen.getByText("Live")).toBeTruthy();
  });
});

describe("EmptyState / ErrorState", () => {
  it("renders an action only when both label and handler are given", () => {
    const onAction = jest.fn();
    const { rerender } = render(<EmptyState title="Nothing here" actionLabel="Add one" />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<EmptyState title="Nothing here" actionLabel="Add one" onAction={onAction} />);
    fireEvent.press(screen.getByRole("button", { name: "Add one" }));
    expect(onAction).toHaveBeenCalled();
  });

  it("offers retry", () => {
    const onRetry = jest.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ImagePickerGrid", () => {
  const images = [
    { key: "a", uri: "file://a" },
    { key: "b", uri: "file://b" },
  ];

  it("shows the count, removes by key, and adds while under the max", () => {
    const onAdd = jest.fn();
    const onRemove = jest.fn();
    render(
      <ImagePickerGrid label="Images" images={images} max={4} onAdd={onAdd} onRemove={onRemove} />,
    );
    expect(screen.getByText("2 / 4")).toBeTruthy();
    fireEvent.press(screen.getAllByRole("button", { name: "Remove image" })[1]!);
    expect(onRemove).toHaveBeenCalledWith("b");
    fireEvent.press(screen.getByRole("button", { name: "Add image to Images" }));
    expect(onAdd).toHaveBeenCalled();
  });

  it("hides the add tile at the max", () => {
    render(
      <ImagePickerGrid
        label="Images"
        images={images}
        max={2}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Add image to Images" })).toBeNull();
  });

  it("is read-only when disabled", () => {
    render(
      <ImagePickerGrid
        label="Images"
        images={images}
        max={4}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        disabled
      />,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("shows an error in place of the hint", () => {
    render(
      <ImagePickerGrid
        label="Images"
        images={[]}
        max={4}
        onAdd={jest.fn()}
        onRemove={jest.fn()}
        hint="Up to 4"
        error="Too big"
      />,
    );
    expect(screen.getByText("Too big")).toBeTruthy();
    expect(screen.queryByText("Up to 4")).toBeNull();
  });
});

describe("Gallery", () => {
  it("renders nothing for no images", () => {
    const { toJSON } = render(<Gallery images={[]} />);
    expect(toJSON()).toBeNull();
  });

  it("opens a full-screen viewer with the caption and closes it", () => {
    render(<Gallery images={[{ key: "1", uri: "file://1", caption: "Booking flow" }]} />);
    fireEvent.press(screen.getByRole("imagebutton", { name: "Booking flow" }));
    expect(screen.getAllByText("Booking flow")).toHaveLength(2);
    fireEvent.press(screen.getByRole("button", { name: "Close image" }));
    expect(screen.getAllByText("Booking flow")).toHaveLength(1);
  });
});

describe("PageHero", () => {
  it("renders the title as a header, subtitle and children", () => {
    render(
      <PageHero theme={tabThemes.discover} title="Discover" subtitle="Reviewed listings">
        <HeroStat value={3} label="live" />
      </PageHero>,
    );
    expect(screen.getByRole("header", { name: "Discover" })).toBeTruthy();
    expect(screen.getByText("Reviewed listings")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });
});

describe("tab themes", () => {
  it("gives every tab a distinct tint", () => {
    const tints = Object.values(tabThemes).map((theme) => theme.tint);
    expect(new Set(tints).size).toBe(tints.length);
  });
});
